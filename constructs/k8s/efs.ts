import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { ServiceAccount } from "./serviceAccount";
import { EfsPolicy } from "../policies";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";

export interface EfsEksVolumeProps {
  vpc: awsx.ec2.Vpc;
  cluster: eks.Cluster;
  provider: k8s.Provider;
  clusterOidcProvider: aws.iam.OpenIdConnectProvider;
}

const wwwDataId = 82;

export class EfsEksVolume {
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
          securityGroups: [
            cluster.nodeSecurityGroup.id,
            cluster.clusterSecurityGroup.id,
          ],
        });
      })
    );
    new k8s.helm.v3.Release("aws-efs-csi-driver", {
      chart: "aws-efs-csi-driver",
      namespace: "kube-system",
      name: "aws-efs-csi-driver-08d85bf2",
      values: {
        fileSystemId: efs.id,
        directoryPerms: 777,
        provisioningMode: "efs-ap",
        uid: wwwDataId,
        gid: wwwDataId,
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


    new k8s.storage.v1.StorageClass(
      `${stack}-website-sc`,
      {
        metadata: {
          name: `${stack}-website-sc`,
        },
        mountOptions: ["tls"],
        parameters: {
          directoryPerms: "700",
          fileSystemId: efs.id,
          provisioningMode: "efs-ap",
          gidRangeStart: "1000",
          gidRangeEnd: "2000",
          basePath: "/dynamic_provisioning",
        },
        provisioner: "efs.csi.aws.com",
        // reclaimPolicy: "Delete",
        // volumeBindingMode: "Immediate"
      },
      { provider: props.cluster.provider }
    );

    // new k8s.core.v1.PersistentVolume(
    //     `${stack}-${props.name}-pv`,
    //     {
    //         metadata: {
    //             name: `${stack}-${props.name}-pv`,
    //             namespace: "websites"
    //         },
    //         spec: {
    //             capacity: {storage: "5Gi"},
    //             volumeMode: "Filesystem",
    //             accessModes: ["ReadWriteMany"],
    //             persistentVolumeReclaimPolicy: "Retain",
    //             storageClassName: `${stack}-${props.name}-sc`,
    //             csi: {
    //                 driver: "efs.csi.aws.com",
    //                 volumeHandle: props.efsId
    //             }
    //         }
    //     },
    //     {provider: props.cluster.provider}
    // );

    // new k8s.core.v1.PersistentVolumeClaim(
    //     `${stack}-${props.name}-claim`,
    //     {
    //         metadata: {
    //             name: `${stack}-${props.name}-claim`,
    //             namespace: "websites",
    //             // annotations: {
    //             //     "volume.beta.kubernetes.io/storage-class": `${stack}-${props.name}-sc`
    //             // }
    //         },
    //         spec: {
    //             accessModes: ["ReadWriteMany"],
    //             storageClassName: `${stack}-${props.name}-sc`,
    //             resources: {requests: {storage: "5Gi"}}
    //         }
    //     },
    //     {provider: props.cluster.provider}
    // );
  }
}
