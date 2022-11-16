import * as awsx from "@pulumi/awsx";
import {BastionHost} from "./constructs/bastion";
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import {CoreStackProps} from "./constructs/types";
import {AuroraPostgresqlServerlessCluster, DB_PORT,} from "./constructs/database";
import * as eks from "@pulumi/eks";
import {ServiceAccount} from "./constructs/k8s/serviceAccount";
import {AutoScalerControllerPolicy} from "./constructs/policies";
import {REDIS_PORT, RedisCluster} from "./constructs/redis";
import {region} from "./index";
import {EfsEksVolume} from "./constructs/k8s/efs";
import {GrafanaK8s} from "./constructs/grafana";
import {EksCluster} from "./constructs/eks";
import {Vpc} from "./constructs/vpc";
import {DatabaseExternalSecret, ExternalSecrets,} from "./constructs/k8s/externalSecrets";
import {Flagger} from "./constructs/k8s/flagger";
import {K8sObservability} from "./constructs/k8s/observability";
import {AwsNginxIngress} from "./constructs/k8s/ingress";
import {controllerAffinity, coreControllerTaint} from "./configs/consts";
import {websitesDbMap} from "./configs/siteMap";
import {DnsConfiguration} from "./constructs/dns";
import {Output} from "@pulumi/pulumi/output";
import {configClusterExternalSecret} from "./constructs/secrets";


export interface websitesSecretsOutput {
  name:string
  securityGroupId:Output<string>
}
export class CoreStack {
  readonly vpc: awsx.ec2.Vpc;
  readonly cluster: eks.Cluster;
  readonly clusterOidcProvider: aws.iam.OpenIdConnectProvider;
  readonly dbCluster: AuroraPostgresqlServerlessCluster;
  readonly cacheCluster: RedisCluster;
  readonly bastion: BastionHost;
  readonly bucket?: aws.s3.Bucket;
  readonly websiteSecrets: {[name:string]:websitesSecretsOutput};

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

    // Databases

    this.cacheCluster = new RedisCluster(stack, {
      name: "cache",
      vpc: this.vpc,
    });
    this.dbCluster = new AuroraPostgresqlServerlessCluster(
      stack,
      {
        databaseName: "website",
        vpc: this.vpc,
        masterPassword: config.requireSecret("dbPassword"),
        masterUsername: config.requireSecret("dbUsername"),
      },
      tags
    );


    this.bastion = new BastionHost(stack, this.vpc, props.sshKeyName, tags);
    new aws.ec2.SecurityGroupRule(`${stack}-bastion-db-rule`, {
      type: "ingress",
      fromPort: DB_PORT,
      toPort: DB_PORT,
      protocol: "tcp",
      securityGroupId: this.bastion.sg.id,
      sourceSecurityGroupId: this.dbCluster.sg.id,
    });
    new aws.ec2.SecurityGroupRule(`${stack}-bastion-redis-rule`, {
        type: "ingress",
        fromPort: REDIS_PORT,
        toPort: REDIS_PORT,
        protocol: "tcp",
        securityGroupId: this.bastion.sg.id,
        sourceSecurityGroupId: this.cacheCluster.sg.id,
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

    this.websiteSecrets = {};
    websitesDbMap.forEach((sites, index) => {
      const name = sites.length != 1 ? `websites-${index}` : sites[0].name;
      const db = props.databasePerSite
        ? new AuroraPostgresqlServerlessCluster(stack, {
            databaseName: name,
            vpc: this.vpc,
            minCapacity: 0.5,
            maxCapacity: 3,
            masterPassword: config.requireSecret("dbPassword"),
            masterUsername: config.requireSecret("dbUsername"),
          })
        : this.dbCluster;
      sites.forEach(site => {
          const name = `${site.siteId}-${site.name}-database`;
      new DatabaseExternalSecret(stack, {
        secretStore,
        name,
        namespace: websitesNamespace,
        secretsManagerSecretName: db.secret.name,
      });
      this.websiteSecrets[name] = { name, securityGroupId:db.sg.id};
      }
      )
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

    // Volumes
    new EfsEksVolume(stack, {
      vpc: this.vpc,
      cluster,
      clusterOidcProvider,
      provider,
      securityGroups: [
          this.bastion.sg.id
      ]
    });

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

    configClusterExternalSecret("aws-user-credentials", {
      namespace: websitesNamespace,
      keys: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
    });

    // TODO import Prod
    this.bucket = new aws.s3.Bucket(
      `${stack}-websites-bucket`,
      {
        arn: "arn:aws:s3:::dating-sites-staging",
        bucket: "dating-sites-staging",
        hostedZoneId: "Z3GKZC51ZF0DB4",
        requestPayer: "BucketOwner",
      },
      {
        protect: true,
      }
    );
  }
}
