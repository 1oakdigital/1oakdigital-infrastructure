import * as aws from "@pulumi/aws";
import * as eks from "@pulumi/eks";
import * as awsx from "@pulumi/awsx";
import {createNodeRole} from "./helpers";



export interface EksClusterProps {
  vpc:awsx.ec2.Vpc,
  clusterName:string
}

export class EksCluster {
  readonly cluster: eks.Cluster
  readonly clusterOidcProvider: aws.iam.OpenIdConnectProvider

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
      nodeGroupOptions: {
        instanceType: "t3.medium",
        instanceProfile: profile,
        extraNodeSecurityGroups: [nodeSg],
      },
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
  }
}
