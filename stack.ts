import * as awsx from "@pulumi/awsx";
import { BastionHost } from "./constructs/bastion";
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { CoreStackProps } from "./constructs/types";
import {
  AuroraPostgresqlServerlessCluster,
  DB_PORT,
} from "./constructs/database";
import * as eks from "@pulumi/eks";
import { REDIS_PORT, RedisCluster } from "./constructs/redis";
import { GrafanaK8s } from "./constructs/grafana";
import { EksCluster } from "./constructs/eks";
import { Vpc } from "./constructs/vpc";
import {
  DatabaseExternalSecret,
  ExternalSecrets,
} from "./constructs/k8s/externalSecrets";
import { Flagger } from "./constructs/k8s/flagger";
import { K8sObservability } from "./constructs/k8s/observability";
import { AwsNginxIngress } from "./constructs/k8s/ingress";
import { controllerAffinity, coreControllerTaint } from "./configs/consts";
import { websitesDbMap } from "./configs/siteMap";
import { DnsConfiguration } from "./constructs/dns";
import { Output } from "@pulumi/pulumi/output";
import { DmsReplication } from "./constructs/replication";
import { region } from "./index";
import { SecurityHub } from "./constructs/securityHub";
import { AwsConfig } from "./constructs/config";
import { GithubRunner } from "./constructs/githubRunner";

export interface websitesSecretsOutput {
  name: string;
  securityGroupId: Output<string>;
}

export class CoreStack {
  readonly vpc: awsx.ec2.Vpc;
  readonly cluster: eks.Cluster;
  readonly clusterOidcProvider: aws.iam.OpenIdConnectProvider;
  readonly dbCluster: AuroraPostgresqlServerlessCluster;
  readonly cacheCluster: RedisCluster;
  readonly bastion: BastionHost;
  readonly bucket: aws.s3.Bucket;
  readonly websiteSecrets: { [name: string]: websitesSecretsOutput };

  constructor(stack: string, props: CoreStackProps) {
    const config = new pulumi.Config();
    const tags = { stack: stack };
    const clusterName = `${stack}-eks-cluster`;

    this.vpc = new Vpc(
      stack,
      {
        clusterName,
        cidrBlock: props.cidrBlock ?? "10.0.0.0/18",
        numberOfAvailabilityZones: props.numberOfAvailabilityZones ?? 3,
      },
      tags
    ).vpc;

    // EKS cluster configuration

    const { cluster, clusterOidcProvider } = new EksCluster(
      stack,
      {
        vpc: this.vpc,
        clusterName,
      },
      tags
    );
    this.cluster = cluster;
    this.clusterOidcProvider = clusterOidcProvider;

    // Default namespaces
    const automationNamespace = "automation";
    const websitesNamespace = "websites";
    const provider = this.cluster.provider;
    new k8s.core.v1.Namespace(
      automationNamespace,
      { metadata: { name: automationNamespace } },
      { provider, deleteBeforeReplace: true }
    );
    new k8s.core.v1.Namespace(
      websitesNamespace,
      { metadata: { name: websitesNamespace } },
      { provider, deleteBeforeReplace: true }
    );
    new k8s.core.v1.Namespace(
      "aws-observability",
      {
        metadata: {
          name: "aws-observability",
          labels: { observability: "enabled" },
        },
      },
      { provider, deleteBeforeReplace: true }
    );

    // At the top since ServiceMonitors are enabled
    new k8s.helm.v3.Release("grafana-agent-operator", {
      chart: "grafana-agent-operator",
      version: "0.2.8",
      repositoryOpts: {
        repo: "https://grafana.github.io/helm-charts",
      },
    });

    // Secrets
    const { secretStore } = new ExternalSecrets(stack, {
      cluster,
      clusterOidcProvider,
      provider,
    });

    // Databases

    this.cacheCluster = new RedisCluster(stack, {
      name: "cache",
      vpc: this.vpc,
      nodeType: props.redisNodeType,
    });
    // Allow node to connect to redis cluster
    new aws.ec2.SecurityGroupRule(`node-redis-rule`, {
      type: "ingress",
      fromPort: REDIS_PORT,
      toPort: REDIS_PORT,
      protocol: "tcp",
      securityGroupId: this.cacheCluster.sg.id,
      sourceSecurityGroupId: cluster.nodeSecurityGroup.id,
    });

    this.dbCluster = new AuroraPostgresqlServerlessCluster(
      stack,
      {
        databaseName: props.databasePerSite ? "admin" : "website",
        vpc: this.vpc,
        masterPassword: config.requireSecret("dbPassword"),
        masterUsername: config.requireSecret("dbUsername"),
        minCapacity: props.adminDbMinCapacity || 1,
        maxCapacity: props.adminDbMaxCapacity || 5,
      },
      tags
    );
    new k8s.apiextensions.CustomResource(
      "db-external-secret",
      {
        apiVersion: "external-secrets.io/v1beta1",
        kind: "ClusterExternalSecret",
        metadata: {
          name: "db-secret",
          namespace: "external-secrets",
        },
        spec: {
          namespaceSelector: {
            matchLabels: { "kubernetes.io/metadata.name": websitesNamespace },
          },
          externalSecretName: "db-secret",
          externalSecretSpec: {
            refreshInterval: "1m",
            secretStoreRef: {
              name: "secretstore-aws",
              kind: "ClusterSecretStore",
            },
            target: {
              name: "database",
              creationPolicyOwner: "Owner",
            },
            data: [
              {
                secretKey: "DB_PASSWORD",
                remoteRef: {
                  key: this.dbCluster.secret.name,
                  property: "password",
                },
              },
              {
                secretKey: "DB_HOST",
                remoteRef: {
                  key: this.dbCluster.secret.name,
                  property: "host",
                },
              },
              {
                secretKey: "DB_USERNAME",
                remoteRef: {
                  key: this.dbCluster.secret.name,
                  property: "username",
                },
              },
            ],
          },
        },
      },
      { dependsOn: secretStore }
    );

    this.bastion = new BastionHost(stack, this.vpc, props.sshKeyName, tags);
    new aws.ec2.SecurityGroupRule(`${stack}-bastion-db-rule`, {
      type: "ingress",
      fromPort: DB_PORT,
      toPort: DB_PORT,
      protocol: "tcp",
      securityGroupId: this.dbCluster.sg.id,
      sourceSecurityGroupId: this.bastion.sg.id,
    });
    new aws.ec2.SecurityGroupRule(`${stack}-bastion-redis-rule`, {
      type: "ingress",
      fromPort: REDIS_PORT,
      toPort: REDIS_PORT,
      protocol: "tcp",
      securityGroupId: this.cacheCluster.sg.id,
      sourceSecurityGroupId: this.bastion.sg.id,
    });

    this.websiteSecrets = {};
    const replicationMapping: { [name: string]: any } = {};
    websitesDbMap.forEach((sites, index) => {
      const databaseName =
        sites.length != 1 ? `websites${index}` : sites[0].name;
      const db = props.databasePerSite
        ? new AuroraPostgresqlServerlessCluster(stack, {
            databaseName,
            vpc: this.vpc,
            minCapacity: props.websitesDbMinCapacity || 0.5,
            maxCapacity: props.websitesDbMaxCapacity || 5,
            masterPassword: config.requireSecret("dbPassword"),
            masterUsername: config.requireSecret("dbUsername"),
          })
        : this.dbCluster;
      sites.forEach((site) => {
        const name = `${site.siteId}-${site.name}-database`;
        // Add database secret for each site
        new DatabaseExternalSecret(stack, {
          secretStore,
          name,
          namespace: websitesNamespace,
          secretsManagerSecretName: db.secret.name,
        });
        this.websiteSecrets[site.name] = { name, securityGroupId: db.sg.id };
        // TODO Delete replication after migration is done
        replicationMapping[site.name] = {
          serverName: db.cluster.endpoint,
          password: db.cluster.masterPassword,
          port: DB_PORT,
          username: db.cluster.masterUsername,
          databaseName: db.cluster.databaseName,
          sgId: db.sg.id,
        };
      });
      if (props.databasePerSite) {
        // Allow bastion to connect to each database
        new aws.ec2.SecurityGroupRule(`${databaseName}-bastion-db-rule`, {
          type: "ingress",
          fromPort: DB_PORT,
          toPort: DB_PORT,
          protocol: "tcp",
          securityGroupId: db.sg.id,
          sourceSecurityGroupId: this.bastion.sg.id,
        });
        // Allow node to connect to each database
        new aws.ec2.SecurityGroupRule(`${databaseName}-node-db-rule`, {
          type: "ingress",
          fromPort: DB_PORT,
          toPort: DB_PORT,
          protocol: "tcp",
          securityGroupId: db.sg.id,
          sourceSecurityGroupId: cluster.nodeSecurityGroup.id,
        });
      }
    });

    // TODO Delete replication after migration is done
    if (stack === "prod") {
      replicationMapping["admin"] = {
        serverName: this.dbCluster.cluster.endpoint,
        password: this.dbCluster.cluster.masterPassword,
        port: DB_PORT,
        username: this.dbCluster.cluster.masterUsername,
        databaseName: this.dbCluster.cluster.databaseName,
        sgId: this.dbCluster.sg.id,
      };
      new DmsReplication(stack, {
        vpc: this.vpc,
        replicationMapping,
      });
    }

    const { domains, certificates } = new DnsConfiguration(stack, {
      subdomain: props.subdomain,
      namespace: automationNamespace,
    });

    // Ingress & Load balancer
    new AwsNginxIngress(stack, {
      cluster,
      clusterOidcProvider,
      namespace: automationNamespace,
      provider,
      clusterName,
      domains,
      certificates,
      minReplicas: props.nginxMinReplicas,
      maxReplicas: props.nginxMaxReplicas,
    });

    // Grafana & Prometheus

    const prometheusUrl =
      "https://prometheus-prod-05-gb-south-0.grafana.net/api/prom";
    const lokiUrl = "https://logs-prod-008.grafana.net/loki/api/v1";
    const username = config.requireSecret("prometheus_user");
    const prometheusReaderSecret = new k8s.core.v1.Secret(
      "prometheus-reader-secret",
      {
        metadata: {
          name: "prometheus-reader",
          namespace: automationNamespace,
        },
        stringData: {
          username,
          password: config.requireSecret("prometheus_reader_key"),
        },
      }
    );
    new k8s.core.v1.Secret("prometheus-reader-secret-default", {
      metadata: {
        name: "prometheus-reader",
        namespace: "default",
      },
      stringData: {
        username,
        password: config.requireSecret("prometheus_reader_key"),
      },
    });

    new GrafanaK8s(stack, clusterName, prometheusUrl, lokiUrl, username);

    // Deployment Controllers
    new Flagger(stack, {
      clusterName,
      provider,
      namespace: automationNamespace,
      clusterOidcProvider,
      prometheusUrl,
      prometheusReaderSecret: prometheusReaderSecret.metadata.name,
    });

    new k8s.helm.v3.Release(
      "vertical-pod-autoscaler",
      {
        chart: "vertical-pod-autoscaler",
        version: "6.0.2",
        values: {
          admissionController: {
            affinity: controllerAffinity,
            tolerations: [coreControllerTaint],
            metrics: { serviceMonitor: { enabled: true } },
          },
          recommender: {
            affinity: controllerAffinity,
            tolerations: [coreControllerTaint],
          },
          updater: {
            affinity: controllerAffinity,
            tolerations: [coreControllerTaint],
          },
        },
        cleanupOnFail: true,
        repositoryOpts: {
          repo: "https://cowboysysop.github.io/charts/",
        },
      },
      { provider, deleteBeforeReplace: true }
    );

    new k8s.helm.v3.Release(
      "aws-node-termination-handler",
      {
        chart: "aws-node-termination-handler",
        version: "0.19.3",
        values: {
          affinity: controllerAffinity,
          tolerations: [coreControllerTaint],
          taintNode: true,
          excludeFromLoadBalancers: true,
          emitKubernetesEvents: true,
        },
        cleanupOnFail: true,
        repositoryOpts: {
          repo: "https://aws.github.io/eks-charts/",
        },
      },
      { provider, deleteBeforeReplace: true }
    );

    // Metrics & Observability
    new K8sObservability(stack, {
      provider,
      namespace: automationNamespace,
      prometheusReaderSecret: prometheusReaderSecret.metadata.name,
    });

    // Shared Secrets and Config maps

    new k8s.core.v1.ConfigMap(`${stack}-redis`, {
      metadata: {
        name: "redis",
        namespace: websitesNamespace,
      },
      data: {
        REDIS_HOST: this.cacheCluster.cluster.cacheNodes[0].address,
        REDIS_PORT: "6379",
      },
    });
    if (stack === "prod")
      new k8s.core.v1.ConfigMap(`${stack}-redis-do`, {
        metadata: {
          name: "redis-do",
          namespace: websitesNamespace,
        },
        data: {
          REDIS_HOST: "redis-live-do-user-7412958-0.b.db.ondigitalocean.com",
          REDIS_PORT: "25061",
          REDIS_PASSWORD: config.requireSecret("redis_password"),
          REDIS_USERNAME: "default",
        },
      });
    new k8s.yaml.ConfigFile(`${stack}-cloudwatch-config`, {
      file: "config/cloudwatch-config.yaml",
    });

    // configClusterExternalSecret("aws-user-credentials", {
    //   namespace: websitesNamespace,
    //   keys: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
    // });

    this.bucket = new aws.s3.Bucket(
      `${stack}-websites-bucket`,
      {
        arn:
          stack == "prod"
            ? "arn:aws:s3:::dating-websites"
            : "arn:aws:s3:::dating-sites-staging",
        bucket: stack == "prod" ? "dating-websites" : "dating-sites-staging",
        hostedZoneId: "Z3GKZC51ZF0DB4",
        requestPayer: "BucketOwner",
      },
      {
        protect: true,
      }
    );

    const cdn = new aws.cloudfront.Distribution(`${stack}-s3-cdn`, {
      enabled: true,
      retainOnDelete: false,
      priceClass: "PriceClass_100",
      defaultCacheBehavior: {
        defaultTtl: 0, // by default, don't cache anything without a Cache-Control header.
        minTtl: 0,
        maxTtl: 365 * 24 * 60 * 60, // allow cache ttls up to 1 year
        allowedMethods: ["GET", "HEAD", "OPTIONS"],
        cachedMethods: ["GET", "HEAD", "OPTIONS"],
        compress: true,
        forwardedValues: {
          cookies: { forward: "all" },
          queryString: true,
        },
        targetOriginId: this.bucket.arn,
        viewerProtocolPolicy: "redirect-to-https",
      },
      orderedCacheBehaviors: [
        // This defines the cache rules *specifically* for assets in /static/, with
        // a few key differences:
        //  - cookies are not forwarded, and hence not used as part of the cache key
        //  - query strings are not forwarded
        //  - a default ttl is set, in case the origin forgets to configure caching
        //  - mutative methods (POST, PUT, etc) are not allowed
        {
          pathPattern: "/*",
          defaultTtl: 60,
          minTtl: 60,
          maxTtl: 120,
          compress: true,
          allowedMethods: ["HEAD", "GET", "OPTIONS"],
          cachedMethods: ["GET", "HEAD", "OPTIONS"],
          targetOriginId: this.bucket.arn,
          forwardedValues: {
            cookies: { forward: "none" },
            queryString: true,
            headers: [],
          },
          viewerProtocolPolicy: "redirect-to-https",
        },
      ],
      origins: [
        {
          domainName: this.bucket.bucketRegionalDomainName,
          originId: this.bucket.arn,
          // s3OriginConfig: {
          //   originAccessIdentity: originAccessIdentity.cloudfrontAccessIdentityPath,
          // },
        },
      ],
      restrictions: {
        geoRestriction: {
          restrictionType: "none",
        },
      },
      viewerCertificate: {
        // ...certs,
        cloudfrontDefaultCertificate: true,
        // minimumProtocolVersion: "TLSv1.2_2021",
        // sslSupportMethod: "sni-only",
      },
      // aliases: landingDomains,
      tags,
    });

    new k8s.core.v1.ConfigMap(`${stack}-shared-env`, {
      metadata: {
        name: "shared",
        namespace: websitesNamespace,
      },
      data: {
        CDN_URL: pulumi.interpolate`https://${cdn.domainName}/`,
        AWS_BUCKET: this.bucket.bucket,
      },
    });

    if (stack == "dev") {
      new GithubRunner(clusterOidcProvider);
    }
  }
}

export class BaseStack {
  constructor(stack: string) {
    const tags = { stack: stack };
    const accountId = "707053725174";
    const phpFmpRepository = new aws.ecr.Repository("php-fpm-repository", {
      name: "php-fpm",
    });
    const phpCliRepository = new aws.ecr.Repository("php-cli-repository", {
      name: "php-cli",
    });

    // Security

    const accessLoggingBucket = new aws.s3.BucketV2(`AccessLoggingBucket`);
    new aws.s3.BucketVersioningV2("AccessLoggingBucketVersioning", {
      bucket: accessLoggingBucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });
    new aws.s3.BucketAclV2("accessLoggingBucketAcl", {
      bucket: accessLoggingBucket.id,
      acl: "log-delivery-write",
    });
    new aws.s3.BucketServerSideEncryptionConfigurationV2(
      "accessLoggingBucketEncryption",
      {
        bucket: accessLoggingBucket.bucket,
        rules: [
          {
            bucketKeyEnabled: true,
            applyServerSideEncryptionByDefault: {
              sseAlgorithm: "aws:kms",
            },
          },
        ],
      }
    );
    new aws.s3.BucketPublicAccessBlock("AccessLoggingBucketPublicAccessBlock", {
      bucket: accessLoggingBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    const flowLogBucket = new aws.s3.BucketV2(`${stack}-vpc-flow-log-bucket`, {
      loggings: [
        { targetBucket: accessLoggingBucket.bucket, targetPrefix: "flow-logs" },
      ],
    });
    // new aws.ec2.FlowLog(`${stack}-vpc-flow-log`, {
    //   logDestination: flowLogBucket.arn,
    //   logDestinationType: "s3",
    //   trafficType: "ALL",
    //   vpcId: this.vpc.id,
    // });

    new AwsConfig(stack);

    // IAM
    new aws.accessanalyzer.Analyzer("IamAccessAnalyzer", {
      analyzerName: "BaseAnalyzer",
    });
    new aws.iam.AccountPasswordPolicy("AccountPasswordPolicy", {
      allowUsersToChangePassword: true,
      minimumPasswordLength: 14,
      requireLowercaseCharacters: true,
      requireNumbers: true,
      requireSymbols: true,
      requireUppercaseCharacters: true,
    });

    new aws.guardduty.Detector("GuardDutyDetector", {
      datasources: {
        s3Logs: {
          enable: true,
        },
      },
      enable: true,
    });

    // Cloud Trail
    const cloudTrailKey = new aws.kms.Key(`cloudtrail-kms`, {
      customerMasterKeySpec: "SYMMETRIC_DEFAULT",
      keyUsage: "ENCRYPT_DECRYPT",
      description: "encrypts cloudtrail events",
      tags,
      // policy: pulumi.all([accountId]).apply((accountId) =>
      //
      // ),
      policy: JSON.stringify({
        Version: "2012-10-17",
        Id: "Key policy created by CloudTrail",
        Statement: [
          {
            Sid: "Enable IAM User Permissions",
            Effect: "Allow",
            Principal: {
              AWS: ["arn:aws:iam::707053725174:root"],
            },
            Action: "kms:*",
            Resource: "*",
          },
          {
            Sid: "Allow CloudTrail to encrypt logs",
            Effect: "Allow",
            Principal: {
              Service: "cloudtrail.amazonaws.com",
            },
            Action: "kms:GenerateDataKey*",
            Resource: "*",
            Condition: {
              StringEquals: {
                "AWS:SourceArn":
                  "arn:aws:cloudtrail:eu-west-2:707053725174:trail/base-trail",
              },
              StringLike: {
                "kms:EncryptionContext:aws:cloudtrail:arn":
                  "arn:aws:cloudtrail:*:707053725174:trail/*",
              },
            },
          },
          {
            Sid: "Allow CloudTrail to describe key",
            Effect: "Allow",
            Principal: {
              Service: "cloudtrail.amazonaws.com",
            },
            Action: "kms:DescribeKey",
            Resource: "*",
          },
          {
            Sid: "Allow principals in the account to decrypt log files",
            Effect: "Allow",
            Principal: {
              AWS: "*",
            },
            Action: ["kms:Decrypt", "kms:ReEncryptFrom"],
            Resource: "*",
            Condition: {
              StringEquals: {
                "kms:CallerAccount": "707053725174",
              },
              StringLike: {
                "kms:EncryptionContext:aws:cloudtrail:arn":
                  "arn:aws:cloudtrail:*:707053725174:trail/*",
              },
            },
          },
          {
            Sid: "Allow alias creation during setup",
            Effect: "Allow",
            Principal: {
              AWS: "*",
            },
            Action: "kms:CreateAlias",
            Resource: "*",
            Condition: {
              StringEquals: {
                "kms:CallerAccount": "707053725174",
                "kms:ViaService": "ec2.eu-west-2.amazonaws.com",
              },
            },
          },
          {
            Sid: "Enable cross account log decryption",
            Effect: "Allow",
            Principal: {
              AWS: "*",
            },
            Action: ["kms:Decrypt", "kms:ReEncryptFrom"],
            Resource: "*",
            Condition: {
              StringEquals: {
                "kms:CallerAccount": "707053725174",
              },
              StringLike: {
                "kms:EncryptionContext:aws:cloudtrail:arn":
                  "arn:aws:cloudtrail:*:707053725174:trail/*",
              },
            },
          },
        ],
      }),
    });
    const cloudtrailLogsGroup = new aws.cloudwatch.LogGroup("cloudtrail-logs", {
      name: "cloudtrail-logs",
      tags: { stack },
    });
    const cloudtrailCloudwatchRole = new aws.iam.Role(
      "base-trail-cloudwatch-role",
      {
        assumeRolePolicy: {
          Version: "2012-10-17",
          Statement: [
            {
              Action: "sts:AssumeRole",
              Principal: {
                Service: "cloudtrail.amazonaws.com",
              },
              Effect: "Allow",
            },
          ],
        },
        inlinePolicies: [
          {
            name: "cloudwatch",
            policy: cloudtrailLogsGroup.arn.apply((arn) =>
              JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                  {
                    Sid: "AWSCloudTrailCreateLogStream2014110",
                    Effect: "Allow",
                    Action: ["logs:CreateLogStream"],
                    Resource: [`${arn}:log-stream:*`],
                  },
                  {
                    Sid: "AWSCloudTrailPutLogEvents20141101",
                    Effect: "Allow",
                    Action: ["logs:PutLogEvents"],
                    Resource: [`${arn}:log-stream:*`],
                  },
                ],
              })
            ),
          },
        ],
      }
    );
    const baseTrailBucket = new aws.s3.BucketV2("base-trail-bucket", {
      bucket: "skyloop-trails",
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AWSCloudTrailAclCheck20150319",
            Effect: "Allow",
            Principal: { Service: "cloudtrail.amazonaws.com" },
            Action: "s3:GetBucketAcl",
            Resource: "arn:aws:s3:::skyloop-trails",
            Condition: {
              StringEquals: {
                "aws:SourceArn": `arn:aws:cloudtrail:${region}:${accountId}:trail/base-trail`,
              },
            },
          },
          {
            Sid: "AWSCloudTrailWrite20150319",
            Effect: "Allow",
            Principal: { Service: "cloudtrail.amazonaws.com" },
            Action: "s3:PutObject",
            Resource: `arn:aws:s3:::skyloop-trails/AWSLogs/${accountId}/*`,
            Condition: {
              StringEquals: {
                "s3:x-amz-acl": "bucket-owner-full-control",
                "aws:SourceArn": `arn:aws:cloudtrail:${region}:${accountId}:trail/base-trail`,
              },
            },
          },
        ],
      }),
    });
    new aws.s3.BucketVersioningV2("baseTrailBucketVersioning", {
      bucket: accessLoggingBucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });
    new aws.s3.BucketAclV2("baseTrailBucketAcl", {
      bucket: accessLoggingBucket.id,
      acl: "log-delivery-write",
    });
    new aws.s3.BucketServerSideEncryptionConfigurationV2(
      "baseTrailBucketEncryption",
      {
        bucket: accessLoggingBucket.bucket,
        rules: [
          {
            bucketKeyEnabled: true,
            applyServerSideEncryptionByDefault: {
              sseAlgorithm: "aws:kms",
            },
          },
        ],
      }
    );
    new aws.s3.BucketPublicAccessBlock("baseTrailBucketPublicAccessBlock", {
      bucket: accessLoggingBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    new aws.cloudtrail.Trail("base-trail", {
      name: "base-trail",
      isMultiRegionTrail: true,
      enableLogFileValidation: true,
      s3BucketName: baseTrailBucket.bucket,
      cloudWatchLogsGroupArn: pulumi.interpolate`${cloudtrailLogsGroup.arn}:*`,
      cloudWatchLogsRoleArn: cloudtrailCloudwatchRole.arn,

      kmsKeyId: cloudTrailKey.arn,
      insightSelectors: [
        { insightType: "ApiCallRateInsight" },
        { insightType: "ApiErrorRateInsight" },
      ],
    });

    new SecurityHub(stack);
  }
}
