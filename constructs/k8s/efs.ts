import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { ServiceAccount } from "./serviceAccount";
import { EfsPolicy } from "../policies";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import {
  controllerAffinity,
  coreControllerTaint, websiteTaint,
  workerTaint,
} from "../../configs/consts";
import {Output} from "@pulumi/pulumi/output";

export interface EfsEksVolumeProps {
  vpc: awsx.ec2.Vpc;
  cluster: eks.Cluster;
  provider: k8s.Provider;
  clusterOidcProvider: aws.iam.OpenIdConnectProvider;
  securityGroups: Output<string>[]
}

const wwwDataId = "82";

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
            ...props.securityGroups,
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
        gidRangeStart: "1",
        gidRangeEnd: "2000",
        image: {
          repository:
            "602401143452.dkr.ecr.eu-west-2.amazonaws.com/eks/aws-efs-csi-driver",
        },
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

    new k8s.storage.v1.StorageClass(
      `${stack}-website-sc`,
      {
        metadata: {
          name: `${stack}-website-sc`,
        },
        mountOptions: ["tls"],
        parameters: {
          directoryPerms: "777",
          fileSystemId: efs.id,
          provisioningMode: "efs-ap",
          gidRangeStart: "1",
          gidRangeEnd: "2000",
          basePath: "/dynamic_provisioning",
        },
        provisioner: "efs.csi.aws.com",
        // reclaimPolicy: "Retain",
        // volumeBindingMode: "Immediate"
      },
      { provider: props.cluster.provider }
    );

    new k8s.core.v1.PersistentVolume(
        `${stack}-website-pv`,
        {
            metadata: {
                name: `${stack}-website-pv`,
                namespace: "websites"
            },
            spec: {
                capacity: {storage: "5Gi"},
                volumeMode: "Filesystem",
                accessModes: ["ReadWriteMany"],
                persistentVolumeReclaimPolicy: "Retain",
                storageClassName: `${stack}-website-sc`,
                csi: {
                    driver: "efs.csi.aws.com",
                    volumeHandle: efs.id
                }
            }
        },
        {provider: props.cluster.provider}
    );

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
