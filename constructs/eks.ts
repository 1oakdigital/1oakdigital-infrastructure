import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as awsx from "@pulumi/awsx";
import { createNodeRole } from "./helpers";
import {
  coreControllerTaintEks,
  websiteTaint,
  websiteTaintEks,
  workerTaint,
  workerTaintEks,
} from "../configs/consts";
import { config } from "../index";

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
        {
          groups: ["system:masters"],
          roleArn: "arn:aws:iam::707053725174:role/dev-cluster-admin-role",
          username: "arn:aws:iam::707053725174:role/dev-cluster-admin-role",
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

    new eks.ManagedNodeGroup(
      `${stack}-spot`,
      {
        cluster: this.cluster,
        nodeGroupName: `${stack}-spot`,
        nodeRoleArn: nodeRole.arn,
        instanceTypes: ["t3.large", "t3a.large", "m4.large", "m5.large"],
        subnetIds: props.vpc.privateSubnetIds,
        capacityType: "SPOT",
        labels: { "compute-type": "spot" },
        scalingConfig: {
          maxSize: 10,
          minSize: 1,
          desiredSize: 2,
        },
      },
      { ignoreChanges: ["scalingConfig.desiredSize"] }
    );
    new eks.ManagedNodeGroup(
      `${stack}-base`,
      {
        cluster: this.cluster,
        nodeGroupName: `${stack}-base`,
        nodeRoleArn: nodeRole.arn,
        instanceTypes: ["t3.large", "t3a.large", "m4.large", "m5.large"],
        subnetIds: props.vpc.privateSubnetIds,
        capacityType: "ON_DEMAND",
        labels: { "compute-type": "on-demand", type: "website" },
        taints: [websiteTaintEks],
        scalingConfig: {
          maxSize: config.requireNumber("maxOnDemandWebsiteInstances"),
          minSize: config.requireNumber("minOnDemandWebsiteInstances"),
          desiredSize: 3,
        },
      },
      { ignoreChanges: ["scalingConfig.desiredSize"] }
    );

    const websiteLabels = { "compute-type": "spot", type: "website" };
    new eks.ManagedNodeGroup(
      `${stack}-website-ng`,
      {
        cluster: this.cluster,
        nodeGroupName: `${stack}-website-ng`,
        nodeRoleArn: nodeRole.arn,
        instanceTypes: ["r5.large", "t3.xlarge", "t3a.xlarge", "m5.xlarge"],
        subnetIds: props.vpc.privateSubnetIds,
        capacityType: "SPOT",
        taints: [websiteTaintEks],
        labels: websiteLabels,
        tags: websiteLabels,
        scalingConfig: {
          maxSize: config.requireNumber("maxSpotWebsiteInstances"),
          minSize: config.requireNumber("minSpotWebsiteInstances"),
          desiredSize: 5,
        },
      },
      { ignoreChanges: ["scalingConfig.desiredSize"] }
    );

    const workerLabels = { "compute-type": "spot", type: "worker" };
    new eks.ManagedNodeGroup(
      `${stack}-worker-ng`,
      {
        cluster: this.cluster,
        nodeGroupName: `${stack}-worker-ng`,
        nodeRoleArn: nodeRole.arn,
        instanceTypes: ["t3.large", "t3a.large", "m4.large", "m5.large"],
        subnetIds: props.vpc.privateSubnetIds,
        capacityType: "SPOT",
        taints: [workerTaintEks],
        labels: workerLabels,
        tags: workerLabels,
        scalingConfig: {
          maxSize: 30,
          minSize: 1,
          desiredSize: 1,
        },
      },
      { ignoreChanges: ["scalingConfig.desiredSize"] }
    );

    const controllerLabels = { "compute-type": "ondemand", type: "controller" };
    eks.createManagedNodeGroup(
      `${stack}-controller-ng`,
      {
        cluster: this.cluster,
        nodeGroupName: `${stack}-controller-ng`,
        nodeRoleArn: nodeRole.arn,
        instanceTypes: ["t3a.medium", "t3.medium"],
        subnetIds: props.vpc.privateSubnetIds,
        labels: controllerLabels,
        taints: [coreControllerTaintEks],
        tags: controllerLabels,
        scalingConfig: {
          maxSize: 10,
          minSize: 1,
          desiredSize: 1,
        },
      },
      this.cluster
    );
  }
}
