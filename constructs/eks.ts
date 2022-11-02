import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as awsx from "@pulumi/awsx";
import { createNodeRole } from "./helpers";
import {coreControllerTaintEks, websiteTaint, websiteTaintEks, workerTaint, workerTaintEks} from "../configs/consts";

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
      vpcId: props.vpc.vpcId,
      tags,
    });
    this.cluster = new eks.Cluster(`${stack}-eks-cluster`, {
      name: props.clusterName,
      version: "1.23",
      fargate: true,
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
          username:'arn:aws:iam::707053725174:role/dev-cluster-admin-role'
        }
      ],
      nodeGroupOptions: {
        instanceType: "t3.medium",
        instanceProfile: profile,
        extraNodeSecurityGroups: [nodeSg],
      },
      tags: tags
    });
    const clusterName = this.cluster.eksCluster.name;
    // @ts-ignore
    this.clusterOidcProvider = this.cluster.core.oidcProvider;
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

    new eks.ManagedNodeGroup(`${stack}-spot`, {
      cluster: this.cluster,
      nodeGroupName: `${stack}-spot`,
      nodeRoleArn: nodeRole.arn,
      instanceTypes: ["t3.large", "t3a.large", "m4.large", "m5.large"],
      subnetIds: props.vpc.privateSubnetIds,
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

    const websiteLabels = { "compute-type": "spot", type: "website" };
    new eks.ManagedNodeGroup(`${stack}-website-ng`, {
      cluster: this.cluster,
      nodeGroupName: `${stack}-website-ng`,
      nodeRoleArn: nodeRole.arn,
      instanceTypes: ["t3.large", "t3a.large", "m4.large", "m5.large"],
      subnetIds: props.vpc.privateSubnetIds,
      capacityType: "SPOT",
      taints: [websiteTaintEks],
      labels: websiteLabels,
      tags:websiteLabels,
      scalingConfig: {
        maxSize: 30,
        minSize: 1,
        desiredSize: 1,
      },
    });

    const workerLabels = { "compute-type": "spot", type: "worker" };
    new eks.ManagedNodeGroup(`${stack}-worker-ng`, {
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
    });

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
