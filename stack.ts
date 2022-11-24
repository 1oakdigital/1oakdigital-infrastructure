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
import { ServiceAccount } from "./constructs/k8s/serviceAccount";
import { AutoScalerControllerPolicy } from "./constructs/policies";
import { REDIS_PORT, RedisCluster } from "./constructs/redis";
import { region } from "./index";
import { EfsEksVolume } from "./constructs/k8s/efs";
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
import { configClusterExternalSecret } from "./constructs/secrets";

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
  readonly efsFileSystemId: Output<string>;
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
    const nodeSecurityGroupsIds = aws.ec2
      .getSecurityGroupsOutput({
        tags: {
          "aws:eks:cluster-name": `${stack}-eks-cluster`,
        },
      })
      .apply((nodeSecurityGroups) => nodeSecurityGroups.ids);

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
    });
    // Allow node to connect to redis cluster
    nodeSecurityGroupsIds.apply((nodeSecurityGroupsIds) =>
      nodeSecurityGroupsIds.forEach((nodeSecurityGroupId) => {
        new aws.ec2.SecurityGroupRule(
          `${nodeSecurityGroupId}-node-redis-rule`,
          {
            type: "ingress",
            fromPort: REDIS_PORT,
            toPort: REDIS_PORT,
            protocol: "tcp",
            securityGroupId: this.cacheCluster.sg.id,
            sourceSecurityGroupId: nodeSecurityGroupId,
          }
        );
      })
    );
    this.dbCluster = new AuroraPostgresqlServerlessCluster(
      stack,
      {
        databaseName: props.databasePerSite ? "admin" : "website",
        vpc: this.vpc,
        masterPassword: config.requireSecret("dbPassword"),
        masterUsername: config.requireSecret("dbUsername"),
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
            minCapacity: 0.5,
            maxCapacity: 5,
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
        nodeSecurityGroupsIds.apply((nodeSecurityGroupsIds) =>
          nodeSecurityGroupsIds.forEach((nodeSecurityGroupId) => {
            new aws.ec2.SecurityGroupRule(
              `${databaseName}-${nodeSecurityGroupId}-node-db-rule`,
              {
                type: "ingress",
                fromPort: DB_PORT,
                toPort: DB_PORT,
                protocol: "tcp",
                securityGroupId: db.sg.id,
                sourceSecurityGroupId: nodeSecurityGroupId,
              }
            );
          })
        );
      }
    });

    // TODO Delete replication after migration is done
    if (stack === "prod")
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

    // // Scaling
    const autoScalerSA = new ServiceAccount({
      name: `${stack}-cluster-autoscaler`,
      oidcProvider: clusterOidcProvider,
      cluster: this.cluster,
      namespace: "kube-system",
      inlinePolicies: [
        { name: "autoscaler", policy: AutoScalerControllerPolicy },
      ],
    });
    new k8s.helm.v3.Release(
      "cluster-autoscaler",
      {
        chart: "cluster-autoscaler",
        version: "9.21.0",
        namespace: "kube-system",
        values: {
          rbac: { serviceAccount: { name: autoScalerSA.name, create: false } },
          autoDiscovery: { clusterName },
          awsRegion: region,
          serviceMonitor: {
            enabled: true,
            selector: { release: "prometheus" },
            namespace: "kube-system",
          },
          affinity: controllerAffinity,
          tolerations: [coreControllerTaint],
        },
        repositoryOpts: {
          repo: "https://kubernetes.github.io/autoscaler",
        },
      },
      { provider, deleteBeforeReplace: true }
    );
    new k8s.helm.v3.Release(
      "vertical-pod-autoscaler",
      {
        chart: "vertical-pod-autoscaler",
        version: "6.0.0",
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

    // Volumes
    const efs = new EfsEksVolume(stack, {
      vpc: this.vpc,
      cluster,
      clusterOidcProvider,
      provider,
      securityGroups: nodeSecurityGroupsIds.apply((nodeSecurityGroupsIds) => [
        this.bastion.sg.id,
        ...nodeSecurityGroupsIds,
      ]),
    });
    this.efsFileSystemId = efs.fileSystemId;

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
  }
}
