import * as awsx from "@pulumi/awsx";
import {BastionHost} from "./constructs/bastion";
import {Output} from "@pulumi/pulumi/output";
import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import {CoreStackProps} from "./constructs/types";
import {PostgresqlInstance} from "./constructs/database";
import {Certificate} from "./constructs/certificate";
import * as eks from "@pulumi/eks";


function createIAMRole(name: string): aws.iam.Role {
    // Create an IAM Role...
    return new aws.iam.Role(`${name}`, {
        assumeRolePolicy: `{
            "Version": "2012-10-17",
            "Statement":[
              {
                "Sid": "",
                "Effect": "Allow",
                "Principal": {
                  "AWS": "arn:aws:iam::153052954103:root"
                },
                "Action": "sts:AssumeRole"
              }
            ]
           }
        `,
        tags: {
            "clusterAccess": `${name}-usr`,
        },
    });
};

export class CoreStack {
    readonly vpc: awsx.ec2.Vpc;
    readonly cluster: eks.Cluster;
    readonly db?: PostgresqlInstance;
    readonly bastion?: BastionHost;
    readonly secrets?: { [name: string]: Output<string> };
    readonly certificate?: Certificate;
    readonly cloudfrontCertificate?: aws.acm.Certificate;
    readonly hostedZoneId: string;
    readonly domain: string;


    constructor(stack: string, props: CoreStackProps) {
        const config = new pulumi.Config();
        const tags = {stack};
        this.hostedZoneId = props.zoneId;
        this.domain = props.domain ?? props.zoneName;

        const vpc = new awsx.ec2.Vpc(`${stack}-vpc`, {
            cidrBlock: props.cidrBlock ?? "10.0.0.0/24",
            numberOfAvailabilityZones: 2,
            tags: {name: `${stack}-vpc`}
        },);

        this.vpc = vpc;

        const managedPolicyArns: string[] = [
            "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
            "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
            "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
        ];

        // Administrator AWS IAM clusterAdminRole with full access to all AWS resources
        const clusterAdminRole = createIAMRole("clusterAdminRole");

        // Administer Automation role for use in pipelines, e.g. gitlab CI, Teamcity, etc.
        const AutomationRole = createIAMRole("AutomationRole");

        // Administer Prod role for use in Prod environment
        const EnvProdRole = createIAMRole("EnvProdRole");


        // Create the EKS cluster
        this.cluster = new eks.Cluster(`${stack}-eks-cluster`, {
            name: `${stack}-eks-cluster`,
            // Put the cluster in the new VPC created earlier
            vpcId: vpc.vpcId,
            // Public subnets will be used for load balancers
            publicSubnetIds: vpc.publicSubnetIds,
            // Private subnets will be used for cluster nodes
            privateSubnetIds: vpc.privateSubnetIds,
            // Change configuration values to change any of the following settings
            // instanceType: eksNodeInstanceType,
            // desiredCapacity: desiredClusterSize,
            // minSize: minClusterSize,
            // maxSize: maxClusterSize,
            // Do not give the worker nodes public IP addresses
            nodeAssociatePublicIpAddress: false,
            roleMappings: [
                // Provides full administrator cluster access to the k8s cluster
                {
                    groups: ["system:masters"],
                    roleArn: clusterAdminRole.arn,
                    username: "pulumi:admin-usr",
                },
                // Map IAM role arn "AutomationRoleArn" to the k8s user with name "automation-usr", e.g. gitlab CI
                {
                    groups: ["pulumi:automation-grp"],
                    roleArn: AutomationRole.arn,
                    username: "pulumi:automation-usr",
                },
                // Map IAM role arn "EnvProdRoleArn" to the k8s user with name "prod-usr"
                {
                    groups: ["pulumi:prod-grp"],
                    roleArn: EnvProdRole.arn,
                    username: "pulumi:prod-usr",
                },
            ],
            // Uncomment the next two lines for a private cluster (VPN access required)
            // endpointPrivateAccess: true,
            // endpointPublicAccess: false
        });


        /*
         * 3) Single Step deployment of k8s RBAC configuration for user1, user2 and user3 per our example
         */

        // Grant cluster admin access to all admins with k8s ClusterRole and ClusterRoleBinding
        new k8s.rbac.v1.ClusterRole("clusterAdminRole", {
            metadata: {
                name: "clusterAdminRole",
            },
            rules: [{
                apiGroups: ["*"],
                resources: ["*"],
                verbs: ["*"],
            }]
        }, {provider: this.cluster.provider});

        new k8s.rbac.v1.ClusterRoleBinding("cluster-admin-binding", {
            metadata: {
                name: "cluster-admin-binding",
            },
            subjects: [{
                kind: "User",
                name: "pulumi:admin-usr",
            }],
            roleRef: {
                kind: "ClusterRole",
                name: "clusterAdminRole",
                apiGroup: "rbac.authorization.k8s.io",
            },
        }, {provider: this.cluster.provider});

        // User2 called automation-usr for users that have permissions to all k8s resources in the namespace automation
        new k8s.rbac.v1.Role("AutomationRole", {
            metadata: {
                name: "AutomationRole",
                namespace: "automation",
            },
            rules: [{
                apiGroups: ["*"],
                resources: ["*"],
                verbs: ["*"],
            }]
        }, {provider: this.cluster.provider});

        new k8s.rbac.v1.RoleBinding("automation-binding", {
            metadata: {
                name: "automation-binding",
                namespace: "automation",
            },
            subjects: [{
                kind: "User",
                name: "pulumi:automation-usr",
                apiGroup: "rbac.authorization.k8s.io",
            }],
            roleRef: {
                kind: "Role",
                name: "AutomationRole",
                apiGroup: "rbac.authorization.k8s.io",
            },
        }, {provider: this.cluster.provider});

        // User3 called prod-usr for users that have read access to all k8s resources in the namespace env-prod
        new k8s.rbac.v1.Role("EnvProdRole", {
            metadata: {
                name: "EnvProdRole",
                namespace: "prod",
            },
            rules: [{
                apiGroups: ["*"],
                resources: ["*"],
                verbs: ["get", "watch", "list"],
            }],
        }, {provider: this.cluster.provider});

        new k8s.rbac.v1.RoleBinding("env-prod-binding", {
            metadata: {
                name: "env-prod-binding",
                namespace: "prod",
            },
            subjects: [{
                kind: "User",
                name: "pulumi:prod-usr",
                apiGroup: "rbac.authorization.k8s.io",
            }],
            roleRef: {
                kind: "Role",
                name: "EnvProdRole",
                apiGroup: "rbac.authorization.k8s.io",
            },
        }, {provider:this. cluster.provider});


        // Export some values for use elsewhere
        // export const kubeconfig = eksCluster.kubeconfig;


        // AWS
        //
        // this.db = new PostgresqlInstance(stack, {
        //     databaseName: "postgres",
        //     name: "recruitinstantly",
        //     masterPassword: config.requireSecret("db_password"),
        //     subnetIds: vpc.privateSubnetIds,
        //     vpc: vpc
        //   }
        // );
        //
        // if (props.sshKeyName) {
        //   this.bastion = new BastionHost(
        //     stack,
        //     vpc,
        //     props.sshKeyName,
        //     this.domain,
        //     props.zoneId
        //   );
        //   this.db.sg.createIngressRule(`${stack}-bastion-sg-access`, {
        //     protocol: "tcp",
        //     fromPort: 5432,
        //     toPort: 5432,
        //     sourceSecurityGroupId: this.bastion.sg.id
        //   });
        //
        // }
        //
        //
        // this.secrets = {
        //   db_secret_arn: this.db.secret.arn
        // };
        //
        // this.certificate = new Certificate(`${stack}-certificate`, {
        //   domainName: this.domain,
        //   zoneId: props.zoneId,
        //   subjectAlternativeNames: [`*.${this.domain}`],
        //   validationMethod: "DNS",
        //   skipValidation:props.skipCertValidation,
        //   tags
        // });
        //
        // const provider = new Provider(`${stack}-provider-aws-us-east-1`, {
        //   region: "us-east-1"
        // });
        // this.cloudfrontCertificate = new aws.acm.Certificate(
        //   `${stack}-cloudfront-certificate`,
        //   {
        //     domainName: this.domain,
        //     subjectAlternativeNames: [`*.${this.domain}`],
        //     validationMethod: "DNS",
        //     tags
        //   },
        //   { provider, retainOnDelete: true }
        // );


    }


}


