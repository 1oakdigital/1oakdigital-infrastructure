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
import { GrafanaK8s } from "./constructs/k8s/grafana";
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
import { GithubRunner } from "./constructs/k8s/githubRunner";
import * as cloudflare from "@pulumi/cloudflare";
import { domainZoneMap } from "./configs/domains";

export interface websitesSecretsOutput {
  name: string;
  securityGroupId: Output<string>;
}

export class EnvironmentStack {
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

    new aws.ec2.FlowLog(`${stack}-vpc-flow-log`, {
      logDestination: "arn:aws:s3:::base-vpc-flow-log-bucket-fb17e20",
      logDestinationType: "s3",
      trafficType: "ALL",
      vpcId: this.vpc.vpcId,
    });

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
    new aws.ec2.SecurityGroupRule(`main-db-node-db-rule`, {
      type: "ingress",
      fromPort: DB_PORT,
      toPort: DB_PORT,
      protocol: "tcp",
      securityGroupId: this.dbCluster.sg.id,
      sourceSecurityGroupId: cluster.nodeSecurityGroup.id,
    });
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
            refreshInterval: "1h",
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

    const { domains, certificates, cloudfrontCertificate } =
      new DnsConfiguration(stack, {
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
          REDIS_HOST:
            "private-redis-live-do-user-7412958-0.b.db.ondigitalocean.com",
          REDIS_PORT: "25061",
          REDIS_PASSWORD: config.requireSecret("redis_password"),
          REDIS_USERNAME: "default",
        },
      });
    new k8s.yaml.ConfigFile(`${stack}-cloudwatch-config`, {
      file: "config/cloudwatch-config.yaml",
    });
    const cdnOriginAccessControl = new aws.cloudfront.OriginAccessControl(
      `${stack}-s3-cdn-access-control`,
      {
        originAccessControlOriginType: "s3",
        signingBehavior: "always",
        signingProtocol: "sigv4",
      }
    );

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

    const cdnDomains = domains.map((domain) => `cdn-${domain}`);

    const cloudfront = new aws.cloudfront.Distribution(
      `${stack}-s3-cdn`,
      {
        enabled: true,
        retainOnDelete: false,
        priceClass: "PriceClass_100",

        defaultCacheBehavior: {
          cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
          allowedMethods: ["GET", "HEAD", "OPTIONS"],
          cachedMethods: ["GET", "HEAD", "OPTIONS"],
          compress: true,
          targetOriginId: this.bucket.arn,
          viewerProtocolPolicy: "redirect-to-https",
        },
        orderedCacheBehaviors: [
          {
            pathPattern: "/*",
            cachePolicyId: "658327ea-f89d-4fab-a63d-7e88639e58f6",
            compress: true,
            allowedMethods: ["HEAD", "GET", "OPTIONS"],
            cachedMethods: ["GET", "HEAD", "OPTIONS"],
            targetOriginId: this.bucket.arn,
            viewerProtocolPolicy: "allow-all",
          },
        ],
        origins: [
          {
            domainName: this.bucket.bucketRegionalDomainName,
            originId: this.bucket.arn,
            originAccessControlId: cdnOriginAccessControl.id,
          },
        ],
        restrictions: {
          geoRestriction: {
            restrictionType: "none",
          },
        },
        viewerCertificate: {
          acmCertificateArn: cloudfrontCertificate.arn,
          cloudfrontDefaultCertificate: false,
          minimumProtocolVersion: "TLSv1.2_2021",
          sslSupportMethod: "sni-only",
        },
        aliases: [...cdnDomains],
        tags,
      },
      { ignoreChanges: ["defaultCacheBehavior.cachePolicyId"] }
    );
    new aws.s3.BucketPolicy(`${stack}-websites-bucket-cdn-policy`, {
      bucket: this.bucket.bucket,
      policy: pulumi
        .all([cloudfront.arn, this.bucket.arn])
        .apply(([cdnIdentityArn, bucketArn]) =>
          JSON.stringify({
            Version: "2012-10-17",
            Statement: [
              {
                Action: ["s3:GetObject", "s3:GetObjectVersion"],
                Resource: `${bucketArn}/*`,
                Principal: { Service: "cloudfront.amazonaws.com" },
                Effect: "Allow",
                Condition: {
                  StringEquals: {
                    "AWS:SourceArn": cdnIdentityArn,
                  },
                },
              },
              {
                Action: ["s3:GetObject", "s3:GetObjectVersion"],
                Resource: `${bucketArn}/*`,
                Principal: "*",
                Effect: "Allow",
              },
            ],
          })
        ),
    });
    const cdnPrefix = props.subdomain ? `cdn-${props.subdomain}.` : "cdn-";

    cdnDomains.forEach((domain) => {
      new cloudflare.Record(
        domain,
        {
          name: domain,
          zoneId: domainZoneMap[domain.replace(cdnPrefix, "")],
          type: "CNAME",
          value: cloudfront.domainName,
          proxied: true,
        },
        { deleteBeforeReplace: true }
      );
    });

    new k8s.core.v1.ConfigMap(`${stack}-shared-env`, {
      metadata: {
        name: "shared",
        namespace: websitesNamespace,
      },
      data: {
        AWS_BUCKET: this.bucket.bucket,
      },
    });

    if (stack == "dev") {
      new GithubRunner();
    }
  }
}
