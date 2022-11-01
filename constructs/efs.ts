import {EfsProps} from "./types";
import * as k8s from "@pulumi/kubernetes";


export class EfsEksVolume {


    constructor(stack: string, props: EfsProps, tags?: { [key: string]: string }) {

        new k8s.storage.v1.StorageClass(
            `${stack}-${props.name}-sc`,
            {
                metadata: {
                    name: `${stack}-${props.name}-sc`,
                },
                mountOptions: ["tls"],
                parameters: {
                    directoryPerms: "700",
                    fileSystemId: props.efsId,
                    provisioningMode: "efs-ap",
                    gidRangeStart: "1000",
                    gidRangeEnd: "2000",
                    basePath: "/dynamic_provisioning"
                },
                provisioner: "efs.csi.aws.com",
                // reclaimPolicy: "Delete",
                // volumeBindingMode: "Immediate"
            },
            {provider: props.cluster.provider}
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
