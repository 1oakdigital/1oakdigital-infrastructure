import * as awsx from "@pulumi/awsx";
import { BastionHost } from "./constructs/bastion";
import { Output } from "@pulumi/pulumi/output";
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { CoreStackProps } from "./constructs/types";
import {
  AuroraPostgresqlServerlessCluster,
  DB_PORT,
} from "./constructs/database";
import * as eks from "@pulumi/eks";
import { ServiceAccount } from "./constructs/serviceAccount";
import {
  AlbControllerPolicy,
  AutoScalerControllerPolicy,
  EfsPolicy,
  ExternalDnsControllerPolicy,
  ExternalSecretsControllerPolicy,
} from "./constructs/policies";
import { createNodeRole } from "./constructs/helpers";
import { REDIS_PORT, RedisCluster } from "./constructs/redis";
import { region } from "./index";
import { EfsEksVolume } from "./constructs/efs";
import { CloudflareAcmCertificateV2 } from "./constructs/cloudfareCertificate";
import { allDomains, CloudflareDomain } from "./constructs/domains";
import { configClusterExternalSecret } from "./secrets";
import { GrafanaK8s } from "./constructs/grafana";
import { NatGatewayStrategy } from "@pulumi/awsx/types/enums/ec2";
import { splitIntoChunk } from "./helpers";

export class CoreStack {
  readonly vpc: awsx.ec2.Vpc;
  readonly cluster: eks.Cluster;
  readonly dbCluster: AuroraPostgresqlServerlessCluster;
  readonly cacheCluster: RedisCluster;
  readonly bastion?: BastionHost;
  readonly secrets?: { [name: string]: Output<string> };
  // readonly cfCertificate: CloudflareAcmCertificate
  readonly kubeconfig: pulumi.Output<any>;
  readonly bucketName: pulumi.Output<string> | string;

  constructor(stack: string, props: CoreStackProps) {
    const config = new pulumi.Config();
    const tags = { stack };
    // const eip = new aws.ec2.Eip(`${stack}-nat`, { vpc: true })

    const vpc = new awsx.ec2.Vpc(`${stack}-vpc`, {
      cidrBlock: props.cidrBlock ?? "10.0.0.0/18",
      numberOfAvailabilityZones: 3,
      natGateways: { strategy: NatGatewayStrategy.Single },
      tags: { name: `${stack}-vpc` },
      enableDnsHostnames: true,
    });
    this.vpc = vpc;

    this.vpc.privateSubnetIds.apply((subnets) =>
      subnets.forEach((subnetId) => {
        new aws.ec2.Tag(`${subnetId}-cluster-tag`, {
          resourceId: subnetId,
          key: `kubernetes.io/cluster/${stack}-eks-cluster`,
          value: "shared",
        });
        new aws.ec2.Tag(`${subnetId}-elb-tag`, {
          resourceId: subnetId,
          key: "kubernetes.io/role/internal-elb",
          value: "1",
        });
      })
    );
    this.vpc.publicSubnetIds.apply((subnets) =>
      subnets.forEach((subnetId) => {
        new aws.ec2.Tag(`${subnetId}-cluster-tag`, {
          resourceId: subnetId,
          key: `kubernetes.io/cluster/${stack}-eks-cluster`,
          value: "shared",
        });
        new aws.ec2.Tag(`${subnetId}-elb-tag`, {
          resourceId: subnetId,
          key: "kubernetes.io/role/elb",
          value: "1",
        });
      })
    );

    // DNS

    // allDomains.forEach((domain) => {
    //   const domainName = props.subdomain
    //     ? `${props.subdomain}.${domain.domain}`
    //     : domain.domain;
    //   const certificate = new CloudflareAcmCertificate(
    //     `${stack}-${domainName}-cf-certificate`,
    //     {
    //       domainName,
    //       zoneId: domain.zoneId,
    //       subjectAlternativeNames: [`*.${domainName}`],
    //       validationMethod: "DNS",
    //       tags,
    //     }
    //   );
    //   certificates.push(certificate.arn);
    //   domains.push(domainName);
    // });

    const certificates: any[] = [];
    const domains: string[] = [];


    // @ts-ignore
    splitIntoChunk(allDomains, 5).forEach(
      (domainChunk: CloudflareDomain[], chunkIndex) => {
        const subjectAlternativeNames: string[] = [];
        domainChunk.forEach((cloudflareDomain, index) => {
          const domainName = props.subdomain
            ? `${props.subdomain}.${cloudflareDomain.domain}`
            : cloudflareDomain.domain;

          // Use first domain as root in certificate
          if (index !== 0) subjectAlternativeNames.push(domainName);
          domains.push(domainName);
          subjectAlternativeNames.push(`*.${domainName}`);
        });
        const certificate = new CloudflareAcmCertificateV2(
            `${stack}-${chunkIndex}-certificate`,
            {
              domainName: props.subdomain
                ? `${props.subdomain}.${domainChunk[0].domain}`
                : domainChunk[0].domain,
              subdomain: props.subdomain,
              subjectAlternativeNames,
            }
          );
          certificates.push(certificate.arn);
      }
    );

    // new CloudflareAcmCertificate(`${stack}-beta.shag2night.com-cf-certificate`, {
    //   domainName: 'beta.shag2night.com',
    //   zoneId: 'fe7d776e2617c4858abc248460cb27f3',
    //   subjectAlternativeNames: ['*.beta.shag2night.com'],
    //   validationMethod: 'DNS',
    //   tags
    // })

    // Databases

    this.cacheCluster = new RedisCluster(stack, {
      name: "cache",
      vpc: this.vpc,
    });
    this.dbCluster = new AuroraPostgresqlServerlessCluster(stack, {
      databaseName: "website",
      vpc: this.vpc,
      masterPassword: config.requireSecret("dbPassword"),
      masterUsername: config.requireSecret("dbUsername"),
    });

    if (props.sshKeyName) {
      this.bastion = new BastionHost(stack, vpc, props.sshKeyName);
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
    }

    // EKS cluster configuration

    const clusterKey = new aws.kms.Key(
      `${stack}-cluster-key`,
      {
        customerMasterKeySpec: "SYMMETRIC_DEFAULT",
        keyUsage: "ENCRYPT_DECRYPT",
        description: "encrypts cluster",
        tags,
      },
      {
        protect: true, // prevent accidental deletion
      }
    );

    const nodeRole = createNodeRole(`${stack}-eks-role`);
    const profile = new aws.iam.InstanceProfile(`${stack}-ng-profile`, {
      role: nodeRole,
    });

    const nodeSg = new aws.ec2.SecurityGroup(`${stack}-node-sg`, {
      ingress: [
        {
          protocol: "-1",
          fromPort: 0,
          toPort: 0,
          self: true,
        },
      ],
      egress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] },
      ],
      vpcId: vpc.vpcId,
      tags,
    });
    this.cluster = new eks.Cluster(`${stack}-eks-cluster`, {
      name: `${stack}-eks-cluster`,
      version: "1.23",
      fargate: true,
      vpcId: vpc.vpcId,
      createOidcProvider: true,
      skipDefaultNodeGroup: true,
      publicSubnetIds: vpc.publicSubnetIds,
      privateSubnetIds: vpc.privateSubnetIds,
      endpointPrivateAccess: false,
      endpointPublicAccess: true,
      encryptionConfigKeyArn: clusterKey.arn,
      instanceRoles: [nodeRole],
      nodeGroupOptions: {
        instanceType: "t3.medium",
        instanceProfile: profile,
        extraNodeSecurityGroups: [nodeSg],
      },
    });
    const clusterName = this.cluster.eksCluster.name;
    const clusterOidcProvider = this.cluster.core.oidcProvider;
    new aws.eks.Addon(`${stack}-vpc-addon`, {
      clusterName,
      addonName: "vpc-cni",
      resolveConflicts: "OVERWRITE",
    });
    new aws.eks.Addon(`${stack}-kube-proxy-addon`, {
      clusterName,
      addonName: "kube-proxy",
    });

    // Nodes

    // eks.createManagedNodeGroup(
    //         `${stack}-ng-managed-ondemand`, {
    //           cluster: this.cluster,
    //           nodeGroupName: `${stack}-ng-managed-ondemand`,
    //           nodeRoleArn: nodeRole.arn,
    //           instanceTypes: ['t3a.large', 't3.large'],
    //
    //           subnetIds: this.vpc.privateSubnetIds,
    //           labels: { ondemand: 'true' },
    //           scalingConfig: {
    //             maxSize: 3,
    //             minSize: 2,
    //             desiredSize: 3
    //           }
    //         }, this.cluster
    // )

    new eks.ManagedNodeGroup(`${stack}-spot`, {
      cluster: this.cluster,
      nodeGroupName: `${stack}-spot`,
      nodeRoleArn: nodeRole.arn,
      instanceTypes: ["t3.large", "t3a.large", "m4.large", "m5.large"],
      subnetIds: this.vpc.privateSubnetIds,
      capacityType: "SPOT",
      // taints: [
      //   { key: 'compute-type', value: 'spot', effect: 'NO_SCHEDULE' }
      // ],
      labels: { "compute-type": "spot" },
      scalingConfig: {
        maxSize: 10,
        minSize: 5,
        desiredSize: 5,
      },
    });

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
      "external-secrets",
      { metadata: { name: "external-secrets" } },
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
    const externalSecretsServiceAccount = new ServiceAccount({
      name: `${stack}-external-secrets-controller`,
      oidcProvider: clusterOidcProvider,
      cluster: this.cluster,
      namespace: "external-secrets",
      inlinePolicies: [
        { name: "external-secrets", policy: ExternalSecretsControllerPolicy },
      ],
    });
    // const externalSecrets = new k8s.helm.v3.Release(
    //   "external-secrets",
    //   {
    //     chart: "external-secrets",
    //     version: "0.5.9",
    //     namespace: "external-secrets",
    //     values: {
    //       env: { AWS_REGION: region },
    //       serviceAccount: {
    //         create: false,
    //         name: externalSecretsServiceAccount.name,
    //       },
    //     },
    //     repositoryOpts: {
    //       repo: "https://charts.external-secrets.io",
    //     },
    //   },
    //   { provider, deleteBeforeReplace: true }
    // );
    // const secretStore = new k8s.apiextensions.CustomResource(
    //   "external-secrets-secret-store",
    //   {
    //     apiVersion: "external-secrets.io/v1beta1",
    //     kind: "ClusterSecretStore",
    //     metadata: {
    //       name: "secretstore-aws",
    //       namespace: "external-secrets",
    //     },
    //     spec: {
    //       provider: {
    //         aws: {
    //           service: "SecretsManager",
    //           region,
    //           auth: {
    //             jwt: {
    //               serviceAccountRef: {
    //                 name: externalSecretsServiceAccount.name,
    //                 namespace: "external-secrets",
    //               },
    //             },
    //           },
    //         },
    //       },
    //     },
    //   },
    //   { dependsOn: externalSecrets, provider, deleteBeforeReplace: true }
    // );
    // new k8s.apiextensions.CustomResource(
    //   "db-external-secret",
    //   {
    //     apiVersion: "external-secrets.io/v1beta1",
    //     kind: "ClusterExternalSecret",
    //     metadata: {
    //       name: "db-secret",
    //       namespace: "external-secrets",
    //     },
    //     spec: {
    //       namespaceSelector: {
    //         matchLabels: { "kubernetes.io/metadata.name": websitesNamespace },
    //       },
    //       externalSecretName: "db-secret",
    //       externalSecretSpec: {
    //         secretStoreRef: {
    //           name: "secretstore-aws",
    //           kind: "ClusterSecretStore",
    //         },
    //         target: {
    //           name: "database",
    //           creationPolicyOwner: "Owner",
    //         },
    //         data: [
    //           {
    //             secretKey: "DB_PASSWORD",
    //             remoteRef: {
    //               key: this.dbCluster.secret.name,
    //               property: "password",
    //             },
    //           },
    //           {
    //             secretKey: "DB_HOST",
    //             remoteRef: {
    //               key: this.dbCluster.secret.name,
    //               property: "host",
    //             },
    //           },
    //           {
    //             secretKey: "DB_USERNAME",
    //             remoteRef: {
    //               key: this.dbCluster.secret.name,
    //               property: "username",
    //             },
    //           },
    //         ],
    //       },
    //     },
    //   },
    //   { dependsOn: secretStore }
    // );

    // Ingress & Load balancer
    const albServiceAccount = new ServiceAccount({
      name: `${stack}-lb-controller`,
      oidcProvider: clusterOidcProvider,
      cluster: this.cluster,
      namespace: automationNamespace,
      inlinePolicies: [{ name: "alb", policy: AlbControllerPolicy }],
    });
    new k8s.helm.v3.Release("aws-load-balancer-controller", {
      chart: "aws-load-balancer-controller",
      version: "1.4.5",
      namespace: automationNamespace,
      values: {
        clusterName,
        env: { AWS_REGION: region },
        serviceAccount: { create: false, name: albServiceAccount.name },
        serviceMonitor: {
          enabled: true,
          additionalLabels: { release: "prometheus" },
          namespace: automationNamespace,
        },
      },
      repositoryOpts: {
        repo: "https://aws.github.io/eks-charts",
      },
    });

    new k8s.helm.v3.Release(
      "ingress-nginx",
      {
        chart: "ingress-nginx",
        version: "4.3.0",
        namespace: automationNamespace,
        values: {
          controller: {
            autoscaling: {
              enabled: true,
              minReplicas: 1,
              maxReplicas: 2,
            },
            containerPort: {
              http: 80,
              https: 443,
            },
            service: {
              targetPorts: {
                http: "http",
                https: "80",
              },
              annotations: {
                // 'service.beta.kubernetes.io/aws-load-balancer-ssl-cert': certificates[0],
                "external-dns.alpha.kubernetes.io/hostname": domains.toString(),
                "service.beta.kubernetes.io/aws-load-balancer-ssl-cert": pulumi
                  .all(certificates)
                  .apply((certificates) => certificates.toString()),
                "service.beta.kubernetes.io/aws-load-balancer-backend-protocol":
                  "tcp",
                "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled":
                  "true",
                "service.beta.kubernetes.io/aws-load-balancer-ssl-ports": "443",
                "service.beta.kubernetes.io/aws-load-balancer-type": "external",
                "service.beta.kubernetes.io/aws-load-balancer-scheme":
                  "internet-facing",
                "service.beta.kubernetes.io/aws-load-balancer-connection-idle-timeout":
                  "3600",
                "service.beta.kubernetes.io/aws-load-balancer-proxy-protocol":
                  "*",
                "service.beta.kubernetes.io/aws-load-balancer-nlb-target-type":
                  "instance",
                "service.beta.kubernetes.io/aws-load-balancer-ssl-negotiation-policy":
                  "ELBSecurityPolicy-TLS13-1-2-2021-06",
              },
            },
            metrics: {
              enabled: true,
              serviceMonitor: {
                enabled: true,
                additionalLabels: { release: "prometheus" },
              },
              service: {
                annotations: {
                  "prometheus.io/scrape": "true",
                  "prometheus.io/port": "10254",
                },
              },
            },
            podAnnotations: {
              "prometheus.io/scrape": "true",
              "prometheus.io/port": "10254",
            },
          },
        },
        repositoryOpts: {
          repo: "https://kubernetes.github.io/ingress-nginx",
        },
      },
      { provider, deleteBeforeReplace: true }
    );

    const externalDnsSA = new ServiceAccount({
      name: "external-dns",
      oidcProvider: clusterOidcProvider,
      cluster: this.cluster,
      namespace: automationNamespace,
      inlinePolicies: [
        { name: "external-dns", policy: ExternalDnsControllerPolicy },
      ],
    });
    const cloudflareConfig = new pulumi.Config("cloudflare");
    new k8s.core.v1.Secret("cloudflare-credentials", {
      metadata: {
        name: "cloudflare-credentials",
        namespace: automationNamespace,
      },
      stringData: {
        CF_API_TOKEN: cloudflareConfig.requireSecret("apiToken"),
      },
    });
    new k8s.helm.v3.Release("helm-external-dns", {
      chart: "external-dns",
      name: "external-dns",
      version: "1.11.0",
      namespace: automationNamespace,
      values: {
        env: [
          {
            name: "CF_API_TOKEN",
            valueFrom: {
              secretKeyRef: {
                name: "cloudflare-credentials",
                key: "CF_API_TOKEN",
              },
            },
          },
        ],
        serviceAccount: { create: false, name: externalDnsSA.name },
        provider: "cloudflare",
      },
      repositoryOpts: {
        repo: "https://kubernetes-sigs.github.io/external-dns/",
      },
    });

    // Deployment Controllers
    new k8s.helm.v3.Release(
      "flagger",
      {
        chart: "flagger",
        version: "1.22.2",
        namespace: automationNamespace,
        values: {
          logLevel: "debug",
          meshProvider: "nginx",
          // Secrets config disabled, due problems with ExternalSecrets not updating primary secrets
          configTracking: { enabled: true },
          podMonitor: {
            enabled: true,
            additionalLabels: {
              release: "prometheus",
            },
          },
          slack: {
            enabled: true,
            channel: `${stack}-website-deployments`,
            user: "flagger",
            clusterName,
            url: "https://hooks.slack.com/services/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",
          },
        },
        repositoryOpts: {
          repo: "https://flagger.app",
        },
      },
      { provider, deleteBeforeReplace: true }
    );

    new k8s.helm.v3.Release("flagger-loadtester", {
      chart: "loadtester",
      version: "0.24.0",
      name: "flagger-loadtester",
      namespace: automationNamespace,
      repositoryOpts: {
        repo: "https://flagger.app",
      },
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
            metrics: { serviceMonitor: { enabled: true } },
          },
        },
        repositoryOpts: {
          repo: "https://cowboysysop.github.io/charts/",
        },
      },
      { provider, deleteBeforeReplace: true }
    );

    // Volumes
    const efs = new aws.efs.FileSystem(`${stack}-eks-storage`, {
      encrypted: true,
      creationToken: `${stack}-website-fs`,
    });
    const efsSA = new ServiceAccount({
      name: "efs",
      oidcProvider: clusterOidcProvider,
      cluster: this.cluster,
      namespace: "kube-system",
      inlinePolicies: [{ name: "efs", policy: EfsPolicy }],
    });
    this.vpc.privateSubnetIds.apply((subnets) =>
      subnets.forEach((subnetId) => {
        new aws.efs.MountTarget(`${stack}-website-${subnetId}-mtg`, {
          fileSystemId: efs.id,
          subnetId,
          securityGroups: [
            this.cluster.nodeSecurityGroup.id,
            this.cluster.clusterSecurityGroup.id,
          ],
        });
      })
    );
    new k8s.helm.v3.Release("aws-efs-csi-driver", {
      chart: "aws-efs-csi-driver",
      namespace: "kube-system",
      values: {
        fileSystemId: efs.id,
        directoryPerms: 777,
        provisioningMode: "efs-ap",
        image: {
          repository:
            "602401143452.dkr.ecr.eu-west-2.amazonaws.com/eks/aws-efs-csi-driver",
        },
        controller: { serviceAccount: { create: false, name: efsSA.name } },
      },
      repositoryOpts: {
        repo: "https://kubernetes-sigs.github.io/aws-efs-csi-driver/",
      },
    });
    new EfsEksVolume(stack, {
      vpc: this.vpc,
      cluster: this.cluster,
      name: "website",
      efsId: efs.id,
    });

    // Metrics & Observability
    new k8s.helm.v3.Release(
      "metrics-server",
      {
        chart: "metrics-server",
        version: "3.8.2",
        name: "metrics-server",
        namespace: "kube-system",
        values: {
          hostNetwork: { enabled: true },
        },
        repositoryOpts: {
          repo: "https://kubernetes-sigs.github.io/metrics-server",
        },
      },
      { provider, deleteBeforeReplace: true }
    );
    new k8s.helm.v3.Release(
      "kube-state-metrics",
      {
        chart: "kube-state-metrics",
        version: "4.21.0",
        values: {
          image: { tag: "v2.6.0" },
          prometheus: {
            monitor: {
              enabled: true,
              honorLabels: true,
              additionalLabels: { release: "prometheus" },
            },
          },
          verticalPodAutoscaler: { enabled: true },
        },
        repositoryOpts: {
          repo: "https://prometheus-community.github.io/helm-charts",
        },
      },
      { provider, deleteBeforeReplace: true }
    );
    new k8s.helm.v3.Release(
      "kubernetes-dashboard",
      {
        chart: "kubernetes-dashboard",
        version: "5.10.0",
        name: "kubernetes-dashboard",
        repositoryOpts: {
          repo: "https://kubernetes.github.io/dashboard",
        },
      },
      { provider, deleteBeforeReplace: true }
    );
    //  Keda
    new k8s.helm.v3.Release("keda", {
      chart: "keda",
      version: "2.8.2",
      name: "keda",
      namespace: automationNamespace,
      values: {
        metricsServer: {
          enabled: true,
        },
        prometheus: {
          metricServer: {
            enabled: true,
            useHostNetwork: false,
            podMonitor: {
              enabled: true,
              additionalLabels: { release: "prometheus" },
              namespace: automationNamespace,
            },
          },
        },
      },
      repositoryOpts: {
        repo: "https://kedacore.github.io/charts",
      },
    });

    // Grafana & Prometheus

    const prometheusUrl =
      "https://prometheus-prod-05-gb-south-0.grafana.net/api/prom";
    const lokiUrl = "https://logs-prod-008.grafana.net/loki/api/v1";
    const username = config.requireSecret("prometheus_user");

    new GrafanaK8s(stack, clusterName, prometheusUrl, lokiUrl, username);

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
    const prometheusReaderSecretDefault = new k8s.core.v1.Secret(
      "prometheus-reader-secret-default",
      {
        metadata: {
          name: "prometheus-reader",
          namespace: "default",
        },
        stringData: {
          username,
          password: config.requireSecret("prometheus_reader_key"),
        },
      }
    );
    new k8s.apiextensions.CustomResource("flagger-metric-template-requests", {
      apiVersion: "flagger.app/v1beta1",
      kind: "MetricTemplate",
      metadata: {
        name: "requests",
        namespace: automationNamespace,
      },
      spec: {
        provider: {
          type: "prometheus",
          address: prometheusUrl,
          secretRef: {
            name: prometheusReaderSecret.metadata.name,
          },
        },
        query: pulumi.interpolate`sum(rate(nginx_ingress_controller_requests{cluster="${clusterName}",ingress="{{ target }}",status!~"[4-5].*",canary=~".*canary.*"}[2m])) / sum(rate(nginx_ingress_controller_requests{cluster="${clusterName}",ingress="{{ target }}",canary=~".*canary.*"}[2m]))`,
      },
    });

    const clusterTriggerAuthentication = new k8s.apiextensions.CustomResource(
      "keda-prometheus-trigger-auth",
      {
        apiVersion: "keda.sh/v1alpha1",
        kind: "ClusterTriggerAuthentication",
        metadata: {
          name: "keda-prometheus",
          // labels
        },
        spec: {
          secretTargetRef: [
            {
              parameter: "username",
              name: prometheusReaderSecret.metadata.name,
              key: "username",
            },
            {
              parameter: "password",
              name: prometheusReaderSecret.metadata.name,
              key: "password",
            },
          ],
        },
      }
    );

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

    // // TODO Import bucket construct
    this.bucketName = "dating-sites-staging";
    //
    this.kubeconfig = this.cluster.kubeconfig;
    configClusterExternalSecret("aws-credentials", {
      namespace: websitesNamespace,
      keys: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
    });
  }
}
