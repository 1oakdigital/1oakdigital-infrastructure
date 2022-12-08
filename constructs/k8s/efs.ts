import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { ServiceAccount } from "./serviceAccount";
import { EfsPolicy } from "../policies";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import {
  controllerAffinity,
  coreControllerTaint,
  websiteTaint,
  workerTaint,
} from "../../configs/consts";
import { Output } from "@pulumi/pulumi/output";
import { OutputInstance } from "@pulumi/pulumi";

export interface EfsEksVolumeProps {
  vpc: awsx.ec2.Vpc;
  cluster: eks.Cluster;
  provider: k8s.Provider;
  clusterOidcProvider: aws.iam.OpenIdConnectProvider;
  securityGroups: Output<string>[];
}

export class EfsEksVolume {
  fileSystemId: Output<string>;
  constructor(
    stack: string,
    props: EfsEksVolumeProps,
    tags?: { [key: string]: string }
  ) {
    const { cluster } = props;
    const efs = new aws.efs.FileSystem(`${stack}-eks-storage`, {
      encrypted: true,
      creationToken: `${stack}-website-fs`,
    });
    this.fileSystemId = efs.id;
    const efsSA = new ServiceAccount({
      name: "efs",
      oidcProvider: props.clusterOidcProvider,
      cluster,
      namespace: "kube-system",
      inlinePolicies: [{ name: "efs", policy: EfsPolicy }],
    });
    props.vpc.privateSubnetIds.apply((subnets) =>
      subnets.forEach((subnetId) => {
        new aws.efs.MountTarget(`${stack}-website-${subnetId}-mtg`, {
          fileSystemId: efs.id,
          subnetId,
          securityGroups: props.securityGroups,
        });
      })
    );

    new k8s.helm.v3.Release("aws-efs-csi-driver", {
      chart: "aws-efs-csi-driver",
      version: "2.3.2",
      namespace: "kube-system",
      name: "aws-efs-csi-driver-08d85bf2",
      values: {
        fileSystemId: efs.id,
        directoryPerms: 777,
        provisioningMode: "efs-ap",
        node: { tolerations: [workerTaint, websiteTaint] },
        controller: {
          affinity: controllerAffinity,
          tolerations: [coreControllerTaint],
          serviceAccount: { create: false, name: efsSA.name },
        },
      },
      repositoryOpts: {
        repo: "https://kubernetes-sigs.github.io/aws-efs-csi-driver/",
      },
    });
  }
}
