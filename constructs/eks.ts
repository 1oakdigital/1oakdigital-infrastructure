import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as awsx from "@pulumi/awsx";
import { createNodeRole } from "./helpers";
import {
  karpenterTaint,
  karpenterTaintEks,
  websiteTaint,
  workerTaint,
} from "../configs/consts";
import { Provisioner } from "../crds/karpenter/provisioners/karpenter/v1alpha5/provisioner";
import { AWSNodeTemplate } from "../crds/karpenter/awsnodetemplates/karpenter/v1alpha1/awsnodeTemplate";
import { ServiceAccount } from "./k8s/serviceAccount";
import { KarpenterPolicy } from "./policies";
import * as k8s from "@pulumi/kubernetes";

export interface EksClusterProps {
  vpc: awsx.ec2.Vpc;
  clusterName: string;
}

export class EksCluster {
  readonly cluster: eks.Cluster;
  readonly clusterOidcProvider: aws.iam.OpenIdConnectProvider;

  constructor(
    stack: string,
    props: EksClusterProps,
    tags?: { [key: string]: string }
  ) {
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
    const karpenterNodeRole = new aws.iam.Role(`${stack}-karpenter-role`, {
      name: `${stack}-karpetner-role`,
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
        Service: "ec2.amazonaws.com",
      }),
      inlinePolicies: [{ name: "karpenter", policy: KarpenterPolicy }],
      managedPolicyArns: [
        "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
        "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
        "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
        "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
      ],
    });
    this.cluster = new eks.Cluster(`${stack}-eks-cluster`, {
      name: props.clusterName,
      version: "1.24",
      fargate: false,
      vpcId: props.vpc.vpcId,
      createOidcProvider: true,
      skipDefaultNodeGroup: true,
      publicSubnetIds: props.vpc.publicSubnetIds,
      privateSubnetIds: props.vpc.privateSubnetIds,
      endpointPrivateAccess: false,
      endpointPublicAccess: true,
      encryptionConfigKeyArn: clusterKey.arn,
      instanceRoles: [nodeRole],
      roleMappings: [
        // {
        //   groups: ["system:masters"],
        //   roleArn: "arn:aws:iam::707053725174:role/dev-cluster-admin-role",
        //   username: "arn:aws:iam::707053725174:role/dev-cluster-admin-role",
        // },
        {
          groups: ["system:masters", "system:nodes"],
          roleArn: karpenterNodeRole.arn,
          username: "system:node:{{EC2PrivateDNSName}}",
        },
      ],
      // clusterTags:tags,
    });

    new aws.iam.RolePolicyAttachment(
      `AmazonEKSVPCResourceController-attachment`,
      {
        policyArn: "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController",
        role: this.cluster.eksCluster.roleArn.apply(
          (roleArn) => roleArn.split("/")[1]
        ),
      }
    );

    const clusterName = this.cluster.eksCluster.name;
    // @ts-ignore
    this.clusterOidcProvider = this.cluster.core.oidcProvider;
    // Must be set once kubectl set env daemonset aws-node -n kube-system ENABLE_POD_ENI=true
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
    const controllerLabels = { "compute-type": "ondemand", type: "controller" };
    eks.createManagedNodeGroup(
      `${stack}-base-node-group`,
      {
        cluster: this.cluster,
        nodeGroupName: `${stack}-base-node-group`,
        nodeRoleArn: nodeRole.arn,
        instanceTypes: ["t3a.medium", "t3.medium", "t3.small", "t3.large"],
        subnetIds: props.vpc.privateSubnetIds,
        labels: controllerLabels,
        taints: [karpenterTaintEks],
        tags: controllerLabels,
        scalingConfig: {
          maxSize: 1,
          minSize: 1,
          desiredSize: 1,
        },
      },
      this.cluster
    );
    const karpenterSa = new ServiceAccount({
      name: "karpenter-prod-sa",
      namespace: "default",
      oidcProvider: this.clusterOidcProvider,
      cluster: this.cluster,
      managedPolicyArns: [
        "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
        "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
        "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
        "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore",
      ],
      inlinePolicies: [{ name: "karpenter", policy: KarpenterPolicy }],
    });

    const karpenterProfile = new aws.iam.InstanceProfile(
      `${stack}-karpenter-profile`,
      {
        role: karpenterNodeRole.name,
      }
    );
    new k8s.helm.v3.Release(
      "karpenter",
      {
        chart: "karpenter",
        name: "karpenter",
        values: {
          serviceMonitor: {
            enabled: true,
            additionalLabels: { release: "prometheus" },
          },
          tolerations: [karpenterTaint],
          clusterName,
          clusterEndpoint: this.cluster.eksCluster.endpoint,
          aws: {
            defaultInstanceProfile: karpenterProfile.name,
          },
          serviceAccount: {
            create: true,
            // name: karpenterSa.name,
            "eks.amazonaws.com/role-arn": karpenterSa.roleArn,
          },
        },
        cleanupOnFail: true,
        repositoryOpts: {
          repo: "https://charts.karpenter.sh/",
        },
      },
      { provider: this.cluster.provider, deleteBeforeReplace: true }
    );

    new AWSNodeTemplate("karpenter-node-template", {
      metadata: {
        name: "default",
      },
      spec: {
        blockDeviceMappings: [
          {
            deviceName: "/dev/xvda",
            ebs: {
              volumeSize: "60Gi",
              volumeType: "gp3",
              iops: 3000,
              encrypted: true,
              // kmsKeyID:
              //   "arn:aws:kms:us-west-2:111122223333:key/1234abcd-12ab-34cd-56ef-1234567890ab",
              deleteOnTermination: true,
              throughput: 125,
            },
          },
        ],
        subnetSelector: {
          // "alpha.eksctl.io/cluster-name": clusterName,
          // @ts-ignore
          Name: "prod-vpc-private*",
        },
        securityGroupSelector: {
          "aws-ids": this.cluster.nodeSecurityGroup.id,
        },
      },
    });
    const websiteLabels = { "compute-type": "spot", type: "website" };
    const workerLabels = { "compute-type": "spot", type: "worker" };
    new Provisioner(`karpenter-provisioner-website`, {
      metadata: {
        name: "website",
      },
      spec: {
        requirements: [
          {
            key: "karpenter.sh/capacity-type",
            operator: "In",
            values: ["spot", "on-demand"],
          },
          {
            key: "karpenter.k8s.aws/instance-size",
            operator: "In",
            values: ["large", "xlarge", "2xlarge", "3xlarge", "4xlarge"],
          },
        ],
        limits: {
          resources: {
            cpu: 100,
            memory: "100Gi",
          },
        },

        taints: [websiteTaint],
        labels: websiteLabels,
        ttlSecondsAfterEmpty: 30,
        ttlSecondsUntilExpired: 2592000,
        providerRef: {
          name: "default",
        },
      },
    });
    new Provisioner(`karpenter-provisioner-worker`, {
      metadata: {
        name: "worker",
      },
      spec: {
        requirements: [
          {
            key: "karpenter.sh/capacity-type",
            operator: "In",
            values: ["spot"],
          },
          {
            key: "karpenter.k8s.aws/instance-size",
            operator: "In",
            values: ["large", "xlarge", "2xlarge", "3xlarge", "4xlarge"],
          },
        ],
        limits: {
          resources: {
            cpu: 100,
            memory: "100Gi",
          },
        },
        taints: [workerTaint],
        labels: workerLabels,
        ttlSecondsAfterEmpty: 30,
        ttlSecondsUntilExpired: 2592000,
        providerRef: {
          name: "default",
        },
      },
    });
    new Provisioner(`karpenter-provisioner-controller`, {
      metadata: {
        name: "controller",
      },
      spec: {
        requirements: [
          {
            key: "karpenter.sh/capacity-type",
            operator: "In",
            values: ["spot", "on-demand"],
          },
          {
            key: "karpenter.k8s.aws/instance-size",
            operator: "NotIn",
            values: ["nano", "micro", "small", "medium"],
          },
        ],
        limits: {
          resources: {
            cpu: 100,
            memory: "500Gi",
          },
        },
        labels: controllerLabels,
        ttlSecondsAfterEmpty: 30,
        ttlSecondsUntilExpired: 2592000,
        providerRef: {
          name: "default",
        },
      },
    });
  }
}
