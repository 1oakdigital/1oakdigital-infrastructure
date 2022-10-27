import * as awsx from "@pulumi/awsx";
import {BastionHost} from "./constructs/bastion";
import {Output} from "@pulumi/pulumi/output";
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import {CoreStackProps} from "./constructs/types";
import {AuroraPostgresqlServerlessCluster, DB_PORT} from "./constructs/database";
import * as eks from "@pulumi/eks";
import {ServiceAccount} from "./constructs/serviceAccount";
import {
    AlbControllerPolicy,
    AutoScalerControllerPolicy,
    EfsPolicy,
    ExternalDnsControllerPolicy,
    ExternalSecretsControllerPolicy
} from "./constructs/policies";
import {createNodeRole} from "./constructs/helpers";
import {REDIS_PORT, RedisCluster} from "./constructs/redis";
import {region} from "./index";
import {EfsEksVolume} from "./constructs/efs";
import {CloudflareAcmCertificate} from "./constructs/cloudfareCertificate";
import {adminDomains} from "./constructs/domains";
import {configClusterExternalSecret} from "./secrets";
import {GrafanaK8s} from "./constructs/grafana";


export class CoreStack {
    readonly vpc: awsx.ec2.Vpc;
    readonly cluster: eks.Cluster;
    readonly dbCluster: AuroraPostgresqlServerlessCluster;
    readonly cacheCluster: RedisCluster;
    readonly bastion?: BastionHost;
    readonly secrets?: { [name: string]: Output<string> };
    readonly cfCertificate: CloudflareAcmCertificate;
    readonly kubeconfig: pulumi.Output<any>;
    readonly bucketName: pulumi.Output<string> | string;


    constructor(stack: string, props: CoreStackProps) {
        const config = new pulumi.Config();
        const tags = {stack};

        const vpc = new awsx.ec2.Vpc(`${stack}-vpc`, {
            cidrBlock: props.cidrBlock ?? "10.0.0.0/18",
            numberOfAvailabilityZones: 3,
            tags: {name: `${stack}-vpc`},
            enableDnsHostnames: true,
        },);
        this.vpc = vpc;


        // DNS
        const certificates = []
        const domains: string[] = []
        adminDomains.forEach(domain => {
            const domainName = props.subdomain ? `${props.subdomain}.${domain.domain}` : domain.domain
            const certificate = new CloudflareAcmCertificate(`${stack}-${domainName}-cf-certificate`, {
                domainName: domainName,
                zoneId: domain.zoneId,
                subjectAlternativeNames: [`*.${domainName}`],
                validationMethod: "DNS",
                tags
            });
            certificates.push(certificate)
            domains.push(domainName)
        })


        this.cfCertificate = new CloudflareAcmCertificate(`${stack}-cf-certificate`, {
            domainName: "beta.shag2night.com",
            zoneId: "fe7d776e2617c4858abc248460cb27f3",
            subjectAlternativeNames: [`*.beta.shag2night.com`],
            validationMethod: "DNS",
            tags
        });

        // Databases

        this.cacheCluster = new RedisCluster(stack, {
            name: "cache",
            vpc: this.vpc
        })
        this.dbCluster = new AuroraPostgresqlServerlessCluster(stack, {
            databaseName: "website",
            vpc: this.vpc,
            masterPassword: config.requireSecret("dbPassword"),
            masterUsername: config.requireSecret("dbUsername")
        })

          if (props.sshKeyName) {
            this.bastion = new BastionHost(
                stack,
                vpc,
                props.sshKeyName,
            );
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
                description: `encrypts cluster`,
                tags,
            },
            {
                protect: true, // prevent accidental deletion
            },
        );

        const nodeRole = createNodeRole(`${stack}-eks-role`)
        const profile = new aws.iam.InstanceProfile(`${stack}-ng-profile`, {role: nodeRole})

        const nodeSg = new aws.ec2.SecurityGroup(`${stack}-node-sg`, {
            ingress: [
                {
                    protocol: "-1",
                    fromPort: 0,
                    toPort: 0,
                    self: true
                }
            ],
            egress: [
                {protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"]}
            ],
            vpcId: vpc.vpcId,
            tags
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

            // nodeAssociatePublicIpAddress: false,
            endpointPrivateAccess: false,
            endpointPublicAccess: true,
            encryptionConfigKeyArn: clusterKey.arn,
            instanceRoles: [nodeRole],
            nodeGroupOptions: {
                instanceType: "t3.medium",
                instanceProfile: profile,
                extraNodeSecurityGroups: [nodeSg]
            }
            // roleMappings: [
            //     // Provides full administrator cluster access to the k8s cluster
            //     {
            //         groups: ["system:masters"],
            //         roleArn: clusterAdminRole.arn,
            //         username: "pulumi:admin-usr",
            //     },
            //     // Map IAM role arn "AutomationRoleArn" to the k8s user with name "automation-usr", e.g. gitlab CI
            //     {
            //         groups: ["pulumi:automation-grp"],
            //         roleArn: AutomationRole.arn,
            //         username: "pulumi:automation-usr",
            //     },
            //     // Map IAM role arn "EnvProdRoleArn" to the k8s user with name "prod-usr"
            //     {
            //         groups: ["pulumi:prod-grp"],
            //         roleArn: EnvProdRole.arn,
            //         username: "pulumi:prod-usr",
            //     },
            // ],
        });
        const clusterName = this.cluster.eksCluster.name;
        // @ts-ignore
        const clusterOidcProvider = this.cluster.core.oidcProvider;
        new aws.eks.Addon(`${stack}-vpc-addon`, {
            clusterName: clusterName,
            addonName: "vpc-cni",
            resolveConflicts: "OVERWRITE",
        });
        new aws.eks.Addon(`${stack}-kube-proxy-addon`, {
            clusterName: clusterName,
            addonName: "kube-proxy",
        });

        // Nodes

        eks.createManagedNodeGroup(
            `${stack}-ng-managed-ondemand`, {
                cluster: this.cluster,
                nodeGroupName: `${stack}-ng-managed-ondemand`,
                nodeRoleArn: nodeRole.arn,
                instanceTypes: ["t3a.large", "t3.large"],

                subnetIds: this.vpc.privateSubnetIds,
                labels: {"ondemand": "true"},
                scalingConfig: {
                    maxSize: 3,
                    minSize: 2,
                    desiredSize: 3
                },
            }, this.cluster
        )

        new eks.ManagedNodeGroup(`${stack}-spot`, {
            cluster: this.cluster,
            nodeGroupName: `${stack}-spot`,
            nodeRoleArn: nodeRole.arn,
            instanceTypes: ["t3.large", "t3a.large", "m4.large", "m5.large"],
            subnetIds: this.vpc.privateSubnetIds,
            capacityType: "SPOT",
            taints: [
                {key: 'compute-type', value: 'spot', effect: 'NO_SCHEDULE'}
            ],
            labels: {"compute-type": "spot"},
            scalingConfig: {
                maxSize: 10,
                minSize: 2,
                desiredSize: 2
            },

        })

        const fargateRole = new aws.iam.Role(`${stack}-fargate-role`, {
            assumeRolePolicy: JSON.stringify({
                Statement: [{
                    Action: "sts:AssumeRole",
                    Effect: "Allow",
                    Principal: {
                        Service: "eks-fargate-pods.amazonaws.com",
                    },
                }],
                Version: "2012-10-17",
            })
        });
        new aws.iam.RolePolicyAttachment(`${stack}-AmazonEKSFargatePodExecutionRolePolicy`, {
            policyArn: "arn:aws:iam::aws:policy/AmazonEKSFargatePodExecutionRolePolicy",
            role: fargateRole.name,
        });
        const fargateProfile = new aws.eks.FargateProfile(`${stack}-fargate-profile`, {
            clusterName: this.cluster.eksCluster.name,
            podExecutionRoleArn: fargateRole.arn,
            subnetIds: this.vpc.privateSubnetIds,
            selectors: [{
                labels: {instance: "fargate"},
                namespace: "websites"
            }],
        });

        // Default namespaces
        const automationNamespace = "automation"
        const websitesNamespace = "websites"
        new k8s.core.v1.Namespace(automationNamespace, {metadata: {name: automationNamespace}}, {provider: this.cluster.provider})
        new k8s.core.v1.Namespace(websitesNamespace, {metadata: {name: websitesNamespace}}, {provider: this.cluster.provider})
        new k8s.core.v1.Namespace("external-secrets", {metadata: {name: "external-secrets"}}, {provider: this.cluster.provider})
        new k8s.core.v1.Namespace("aws-observability", {
            metadata: {
                name: "aws-observability",
                labels: {"observability": "enabled"}
            }
        }, {provider: this.cluster.provider})

        // Controllers

        // Secrets
        const externalSecretsServiceAccount = new ServiceAccount({
            name: `${stack}-external-secrets-controller`,
            oidcProvider: clusterOidcProvider,
            cluster: this.cluster,
            namespace: "external-secrets",
            inlinePolicies: [{name: "external-secrets", policy: ExternalSecretsControllerPolicy}]
        })
        const externalSecrets = new k8s.helm.v3.Release("external-secrets", {
            chart: "external-secrets",
            version: "0.5.9",
            namespace: "external-secrets",
            values: {
                env: {AWS_REGION: region},
                serviceAccount: {"create": false, name: externalSecretsServiceAccount.name}
            },
            repositoryOpts: {
                repo: "https://charts.external-secrets.io",
            },
        });
        const secretStore = new k8s.apiextensions.CustomResource("external-secrets-secret-store", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ClusterSecretStore",
            metadata: {
                name: "secretstore-aws",
                namespace: "external-secrets"
            },
            spec: {
                provider: {
                    aws: {
                        service: "SecretsManager",
                        region: region,
                        auth: {
                            jwt: {
                                serviceAccountRef: {
                                    name: externalSecretsServiceAccount.name,
                                    namespace: "external-secrets"
                                },


                            }
                        }
                    }
                }
            }
        }, {dependsOn: externalSecrets})
        new k8s.apiextensions.CustomResource("db-external-secret", {
            apiVersion: "external-secrets.io/v1beta1",
            kind: "ClusterExternalSecret",
            metadata: {
                name: "db-secret",
                namespace: "external-secrets"
            },
            spec: {
                namespaceSelector: {matchLabels: {"kubernetes.io/metadata.name": websitesNamespace}},
                externalSecretName: "db-secret",
                externalSecretSpec: {
                    secretStoreRef: {
                        name: "secretstore-aws",
                        kind: "ClusterSecretStore"
                    },
                    target: {
                        name: "database",
                        creationPolicyOwner: "Owner"
                    },
                    data: [
                        {
                            secretKey: "DB_PASSWORD",
                            remoteRef: {
                                key: this.dbCluster.secret.name,
                                property: "password"
                            }
                        },
                        {
                            secretKey: "DB_HOST",
                            remoteRef: {
                                key: this.dbCluster.secret.name,
                                property: "host"
                            }
                        },
                        {
                            secretKey: "DB_USERNAME",
                            remoteRef: {
                                key: this.dbCluster.secret.name,
                                property: "username"
                            },
                        },
                    ]
                }
            }
        }, {dependsOn: secretStore})

        // Ingress & Load balancer
        const albServiceAccount = new ServiceAccount({
            name: `${stack}-lb-controller`,
            // @ts-ignore
            oidcProvider: clusterOidcProvider,
            cluster: this.cluster,
            namespace: automationNamespace,
            inlinePolicies: [{name: "alb", policy: AlbControllerPolicy}]
        })
        new k8s.helm.v3.Release("aws-load-balancer-controller", {
            chart: "aws-load-balancer-controller",
            version: "1.4.5",
            namespace: automationNamespace,
            values: {
                clusterName: clusterName,
                env: {AWS_REGION: region},
                serviceAccount: {create: false, name: albServiceAccount.name},
                serviceMonitor: {
                    enabled: true,
                    additionalLabels: {release: "prometheus"},
                    namespace: automationNamespace
                }
            },
            repositoryOpts: {
                repo: "https://aws.github.io/eks-charts",
            },
        });

        new k8s.helm.v3.Release("ingress-nginx", {
            chart: "ingress-nginx",
            version: "4.3.0",
            namespace: automationNamespace,
            values: {
                controller: {
                    autoscaling: {
                        enabled: true,
                        minReplicas: 1,
                        maxReplicas: 2
                    },
                    containerPort: {
                        http: 80,
                        https: 443,
                    },
                    service: {
                        targetPorts: {
                            http: "http",
                            https: "80"
                        },
                        annotations: {
                            "service.beta.kubernetes.io/aws-load-balancer-ssl-cert": pulumi.interpolate`${this.cfCertificate.arn}`,
                            "service.beta.kubernetes.io/aws-load-balancer-backend-protocol": "tcp",
                            "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled": "true",
                            "service.beta.kubernetes.io/aws-load-balancer-ssl-ports": "https",
                            "service.beta.kubernetes.io/aws-load-balancer-type": "nlb",
                            "service.beta.kubernetes.io/aws-load-balancer-connection-idle-timeout": "3600",
                            "service.beta.kubernetes.io/aws-load-balancer-proxy-protocol": "*",
                        },

                    },
                    metrics: {
                        enabled: true,
                        serviceMonitor: {enabled: true, additionalLabels: {release: "prometheus"}},
                        service: {
                            annotations: {
                                "prometheus.io/scrape": "true",
                                "prometheus.io/port": "10254"
                            }
                        }
                    },
                    podAnnotations: {
                        "prometheus.io/scrape": "true",
                        "prometheus.io/port": "10254"
                    }
                }
            },
            repositoryOpts: {
                repo: "https://kubernetes.github.io/ingress-nginx",
            },
        });

        const externalDnsSA = new ServiceAccount({
            name: "external-dns",
            // @ts-ignore
            oidcProvider: clusterOidcProvider,
            cluster: this.cluster,
            namespace: automationNamespace,
            inlinePolicies: [{name: "external-dns", policy: ExternalDnsControllerPolicy}]
        })
        new k8s.helm.v3.Release("external-dns", {
            chart: "external-dns",
            version: "6.10.1",
            namespace: automationNamespace,
            values: {
                serviceAccount: {create: false, name: externalDnsSA.name}
            },
            repositoryOpts: {
                repo: "https://charts.bitnami.com/bitnami",
            },
        });

        // Deployment Controllers
        new k8s.helm.v3.Release("flagger", {
            chart: "flagger",
            version: "1.22.2",
            namespace: automationNamespace,
            values: {
                logLevel: "debug",
                meshProvider: "nginx",
                // Secrets config disabled, due problems with ExternalSecrets not updating primary secrets
                configTracking: {enabled: true},
                podMonitor: {
                    enabled: true,
                    additionalLabels: {
                        release: "prometheus"
                    }
                },
                slack: {
                    enabled: true,
                    channel: `${stack}-website-deployments`,
                    user: "flagger",
                    clusterName: clusterName,
                    url: "https://hooks.slack.com/services/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"
                }
            },
            repositoryOpts: {
                repo: "https://flagger.app",
            },
        });
        new k8s.apiextensions.CustomResource(`flagger-metric-template-requests`, {
            "apiVersion": "flagger.app/v1beta1",
            "kind": "MetricTemplate",
            "metadata": {
                "name": "requests",
                namespace: automationNamespace,
            },
            "spec": {
                "provider": {
                    "type": "prometheus",
                    "address": "https://prometheus-prod-05-gb-south-0.grafana.net/api/prom/",
                    "secretRef": {
                        "name": "prometheus-reader",
                    }
                },
                // query: 'sum(rate(nginx_ingress_controller_requests{ingress="{{ target }}"}[1m]))',
                query: pulumi.interpolate`sum(rate(nginx_ingress_controller_requests{cluster="${clusterName}",ingress="{{ target }}",status!~"[4-5].*",canary=~".*canary.*"}[2m])) / sum(rate(nginx_ingress_controller_requests{cluster="${clusterName}",ingress="{{ target }}",canary=~".*canary.*"}[2m]))`
            }
        })
        new k8s.helm.v3.Release("flagger-loadtester", {
            chart: "loadtester",
            version: "0.24.0",
            name: "flagger-loadtester",
            namespace: automationNamespace,
            repositoryOpts: {
                repo: "https://flagger.app",
            },
        });


        // Scaling
        const autoScalerSA = new ServiceAccount({
            name: `${stack}-cluster-autoscaler`,
            // @ts-ignore
            oidcProvider: clusterOidcProvider,
            cluster: this.cluster,
            namespace: "kube-system",
            inlinePolicies: [{name: "autoscaler", policy: AutoScalerControllerPolicy}]
        })
        new k8s.helm.v3.Release("cluster-autoscaler", {
            chart: "cluster-autoscaler",
            version: "9.21.0",
            namespace: "kube-system",
            values: {
                rbac: {serviceAccount: {name: autoScalerSA.name, create: false}},
                autoDiscovery: {clusterName: clusterName},
                awsRegion: region,
                serviceMonitor: {enabled: true, selector: {release: "prometheus"}, namespace: "kube-system"}
            },
            repositoryOpts: {
                repo: "https://kubernetes.github.io/autoscaler",
            },
        });
        new k8s.helm.v3.Release("vertical-pod-autoscaler", {
            chart: "vertical-pod-autoscaler",
            version: "6.0.0",
            // values: {
            //     admissionController: {
            //         metrics: {serviceMonitor: {enabled: true}}
            //     }
            // },
            repositoryOpts: {
                repo: "https://cowboysysop.github.io/charts/",
            },
        });


        // Volumes
        const efs = new aws.efs.FileSystem(`${stack}-eks-storage`, {
            encrypted: true,
            creationToken: `${stack}-website-fs`
        })
        const efsSA = new ServiceAccount({
            name: "efs",
            // @ts-ignore
            oidcProvider: clusterOidcProvider,
            cluster: this.cluster,
            namespace: "kube-system",
            inlinePolicies: [{name: "efs", policy: EfsPolicy}]
        })
        this.vpc.privateSubnetIds.apply(subnets => subnets.forEach(subnetId => {
            new aws.efs.MountTarget(`${stack}-website-${subnetId}-mtg`, {
                fileSystemId: efs.id,
                subnetId: subnetId,
                securityGroups: [this.cluster.nodeSecurityGroup.id, this.cluster.clusterSecurityGroup.id],
            });
        }))
        new k8s.helm.v3.Release("aws-efs-csi-driver", {
            chart: "aws-efs-csi-driver",
            namespace: "kube-system",
            values: {
                fileSystemId: efs.id,
                directoryPerms: 777,
                provisioningMode: "efs-ap",
                image: {repository: "602401143452.dkr.ecr.eu-west-2.amazonaws.com/eks/aws-efs-csi-driver"},
                controller: {serviceAccount: {create: false, name: efsSA.name}}
            },
            repositoryOpts: {
                repo: "https://kubernetes-sigs.github.io/aws-efs-csi-driver/",
            },
        });
        new EfsEksVolume(stack, {
            vpc: this.vpc,
            cluster: this.cluster,
            name: "website",
            efsId: efs.id
        })

        // Metrics & Observability

        new k8s.helm.v3.Release("metrics-server", {
            chart: "metrics-server",
            version: "3.8.2",
            name: "metrics-server",
            namespace: "kube-system",
            values: {
                hostNetwork: {enabled: true}
            },
            repositoryOpts: {
                repo: "https://kubernetes-sigs.github.io/metrics-server",
            },
        });
        new k8s.helm.v3.Release("kube-state-metrics", {
            chart: "kube-state-metrics",
            version: "4.21.0",
            values: {
                image: {tag: "v2.6.0"},
                prometheus: {monitor: {enabled: true, honorLabels:true, additionalLabels: {release: "prometheus"}}},
                verticalPodAutoscaler: {enabled: true}
            },
            repositoryOpts: {
                repo: "https://prometheus-community.github.io/helm-charts",
            },
        });
        new k8s.helm.v3.Release("kubernetes-dashboard", {
            chart: "kubernetes-dashboard",
            version: "5.10.0",
            name: "kubernetes-dashboard",
            repositoryOpts: {
                repo: "https://kubernetes.github.io/dashboard",
            },
        });

        // Keda
        const kedaNamespace = new k8s.core.v1.Namespace("keda-namespace", {metadata: {name: "keda"}}, {provider: this.cluster.provider})
        new k8s.helm.v3.Release("keda", {
            chart: "keda",
            version: "2.8.2",
            name: "keda",
            namespace: kedaNamespace.metadata.namespace,
            values: {
                metricsServer: {
                    enabled: true
                },
                prometheus: {
                    metricServer: {
                        enabled: true,
                        useHostNetwork: false,
                        podMonitor: {
                            enabled: true,
                            additionalLabels: {release: "prometheus"},
                            namespace: kedaNamespace.metadata.namespace
                        }
                    },
                }
            },
            repositoryOpts: {
                repo: "https://kedacore.github.io/charts",
            },
        });
        new k8s.apiextensions.CustomResource("keda-prometheus-trigger-auth",
            {
                "apiVersion": "keda.sh/v1alpha1",
                "kind": "ClusterTriggerAuthentication",
                "metadata": {
                    "name": "keda-prometheus",
                    labels: {"release": "prometheus"}
                },
                "spec": {
                    "secretTargetRef": [
                        {
                            "parameter": "username",
                            "name": "prometheus-reader",
                            "key": "username"
                        },
                        {
                            "parameter": "password",
                            "name": "prometheus-reader",
                            "key": "password"
                        }
                    ]
                }
            })



        // Grafana & Prometheus
        new k8s.helm.v3.Release("grafana-agent-operator", {
            chart: "grafana-agent-operator",
            version: "0.2.8",
            repositoryOpts: {
                repo: "https://grafana.github.io/helm-charts",
            },
        });
        new k8s.core.v1.Secret(`prometheus-reader-secret`, {
            metadata: {
                name: "prometheus-reader",
                namespace: kedaNamespace.metadata.name
            },
            stringData: {
                username: "622277",
                password: "eyJrIjoiNDQzN2RjZTkzMDVmNTBhMWQ4MTI0NmFiYjU2YzgyMDQ4OWQ0ZDlmYSIsIm4iOiJyZWFkZXIiLCJpZCI6NzMxNzE4fQ=="
            }
        })
        new k8s.core.v1.Secret(`prometheus-reader-secret-w`, {
            metadata: {
                name: "prometheus-reader",
                namespace: automationNamespace
            },
            stringData: {
                username: "622277",
                password: "eyJrIjoiNDQzN2RjZTkzMDVmNTBhMWQ4MTI0NmFiYjU2YzgyMDQ4OWQ0ZDlmYSIsIm4iOiJyZWFkZXIiLCJpZCI6NzMxNzE4fQ=="
            }
        })
        new k8s.core.v1.Secret(`prometheus-reader-secret-d`, {
            metadata: {
                name: "prometheus-reader",
                namespace: "default"
            },
            stringData: {
                username: "622277",
                password: "eyJrIjoiNDQzN2RjZTkzMDVmNTBhMWQ4MTI0NmFiYjU2YzgyMDQ4OWQ0ZDlmYSIsIm4iOiJyZWFkZXIiLCJpZCI6NzMxNzE4fQ=="
            }
        })

        new GrafanaK8s(stack, clusterName)



        // Shared Secrets and Config maps

        new k8s.core.v1.ConfigMap(
            `${stack}-redis`,
            {
                metadata: {
                    name: "redis",
                    namespace: websitesNamespace,
                },
                data: {
                    REDIS_HOST: this.cacheCluster.cluster.cacheNodes[0].address,
                    REDIS_PORT: "6379",
                },
            },
        );
        new k8s.yaml.ConfigFile(
            `${stack}-cloudwatch-config`,
            {file: "config/cloudwatch-config.yaml"}
        );

        //
        // TODO Import bucket construct
        this.bucketName = "dating-sites-staging"

        this.kubeconfig = this.cluster.kubeconfig
        configClusterExternalSecret("aws-credentials", {
            namespace: websitesNamespace,
            keys: ["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"]
        })
    }
}

