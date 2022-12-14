// *** WARNING: this file was generated by crd2pulumi. ***
// *** Do not edit by hand unless you're certain you know what you are doing! ***

import * as pulumi from "@pulumi/pulumi";
import * as inputs from "../types/input";
import * as outputs from "../types/output";

import {ObjectMeta} from "../meta/v1";

export namespace karpenter {
    export namespace v1alpha5 {
        /**
         * ProvisionerSpec is the top level provisioner specification. Provisioners launch nodes in response to pods that are unschedulable. A single provisioner is capable of managing a diverse set of nodes. Node properties are determined from a combination of provisioner and pod scheduling constraints.
         */
        export interface ProvisionerSpec {
            /**
             * Consolidation are the consolidation parameters
             */
            consolidation?: outputs.karpenter.v1alpha5.ProvisionerSpecConsolidation;
            /**
             * KubeletConfiguration are options passed to the kubelet when provisioning nodes
             */
            kubeletConfiguration?: outputs.karpenter.v1alpha5.ProvisionerSpecKubeletconfiguration;
            /**
             * Labels are layered with Requirements and applied to every node.
             */
            labels?: {[key: string]: string};
            /**
             * Limits define a set of bounds for provisioning capacity.
             */
            limits?: outputs.karpenter.v1alpha5.ProvisionerSpecLimits;
            /**
             * Provider contains fields specific to your cloudprovider.
             */
            provider?: {[key: string]: any};
            /**
             * ProviderRef is a reference to a dedicated CRD for the chosen provider, that holds additional configuration options
             */
            providerRef?: outputs.karpenter.v1alpha5.ProvisionerSpecProviderref;
            /**
             * Requirements are layered with Labels and applied to every node.
             */
            requirements?: outputs.karpenter.v1alpha5.ProvisionerSpecRequirements[];
            /**
             * StartupTaints are taints that are applied to nodes upon startup which are expected to be removed automatically within a short period of time, typically by a DaemonSet that tolerates the taint. These are commonly used by daemonsets to allow initialization and enforce startup ordering.  StartupTaints are ignored for provisioning purposes in that pods are not required to tolerate a StartupTaint in order to have nodes provisioned for them.
             */
            startupTaints?: outputs.karpenter.v1alpha5.ProvisionerSpecStartuptaints[];
            /**
             * Taints will be applied to every node launched by the Provisioner. If specified, the provisioner will not provision nodes for pods that do not have matching tolerations. Additional taints will be created that match pod tolerations on a per-node basis.
             */
            taints?: outputs.karpenter.v1alpha5.ProvisionerSpecTaints[];
            /**
             * TTLSecondsAfterEmpty is the number of seconds the controller will wait before attempting to delete a node, measured from when the node is detected to be empty. A Node is considered to be empty when it does not have pods scheduled to it, excluding daemonsets. 
             *  Termination due to no utilization is disabled if this field is not set.
             */
            ttlSecondsAfterEmpty?: number;
            /**
             * TTLSecondsUntilExpired is the number of seconds the controller will wait before terminating a node, measured from when the node is created. This is useful to implement features like eventually consistent node upgrade, memory leak protection, and disruption testing. 
             *  Termination due to expiration is disabled if this field is not set.
             */
            ttlSecondsUntilExpired?: number;
            /**
             * Weight is the priority given to the provisioner during scheduling. A higher numerical weight indicates that this provisioner will be ordered ahead of other provisioners with lower weights. A provisioner with no weight will be treated as if it is a provisioner with a weight of 0.
             */
            weight?: number;
        }

        /**
         * Consolidation are the consolidation parameters
         */
        export interface ProvisionerSpecConsolidation {
            /**
             * Enabled enables consolidation if it has been set
             */
            enabled?: boolean;
        }

        /**
         * KubeletConfiguration are options passed to the kubelet when provisioning nodes
         */
        export interface ProvisionerSpecKubeletconfiguration {
            /**
             * clusterDNS is a list of IP addresses for the cluster DNS server. Note that not all providers may use all addresses.
             */
            clusterDNS?: string[];
            /**
             * ContainerRuntime is the container runtime to be used with your worker nodes.
             */
            containerRuntime?: string;
            /**
             * EvictionHard is the map of signal names to quantities that define hard eviction thresholds
             */
            evictionHard?: {[key: string]: string};
            /**
             * EvictionMaxPodGracePeriod is the maximum allowed grace period (in seconds) to use when terminating pods in response to soft eviction thresholds being met.
             */
            evictionMaxPodGracePeriod?: number;
            /**
             * EvictionSoft is the map of signal names to quantities that define soft eviction thresholds
             */
            evictionSoft?: {[key: string]: string};
            /**
             * EvictionSoftGracePeriod is the map of signal names to quantities that define grace periods for each eviction signal
             */
            evictionSoftGracePeriod?: {[key: string]: string};
            /**
             * KubeReserved contains resources reserved for Kubernetes system components.
             */
            kubeReserved?: {[key: string]: number | string};
            /**
             * MaxPods is an override for the maximum number of pods that can run on a worker node instance.
             */
            maxPods?: number;
            /**
             * PodsPerCore is an override for the number of pods that can run on a worker node instance based on the number of cpu cores. This value cannot exceed MaxPods, so, if MaxPods is a lower value, that value will be used.
             */
            podsPerCore?: number;
            /**
             * SystemReserved contains resources reserved for OS system daemons and kernel memory.
             */
            systemReserved?: {[key: string]: number | string};
        }

        /**
         * Limits define a set of bounds for provisioning capacity.
         */
        export interface ProvisionerSpecLimits {
            /**
             * Resources contains all the allocatable resources that Karpenter supports for limiting.
             */
            resources?: {[key: string]: number | string};
        }

        /**
         * ProviderRef is a reference to a dedicated CRD for the chosen provider, that holds additional configuration options
         */
        export interface ProvisionerSpecProviderref {
            /**
             * API version of the referent
             */
            apiVersion?: string;
            /**
             * Kind of the referent; More info: https://git.k8s.io/community/contributors/devel/sig-architecture/api-conventions.md#types-kinds"
             */
            kind?: string;
            /**
             * Name of the referent; More info: http://kubernetes.io/docs/user-guide/identifiers#names
             */
            name?: string;
        }

        /**
         * A node selector requirement is a selector that contains values, a key, and an operator that relates the key and values.
         */
        export interface ProvisionerSpecRequirements {
            /**
             * The label key that the selector applies to.
             */
            key: string;
            /**
             * Represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists, DoesNotExist. Gt, and Lt.
             */
            operator: string;
            /**
             * An array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. If the operator is Gt or Lt, the values array must have a single element, which will be interpreted as an integer. This array is replaced during a strategic merge patch.
             */
            values?: string[];
        }

        /**
         * The node this Taint is attached to has the "effect" on any pod that does not tolerate the Taint.
         */
        export interface ProvisionerSpecStartuptaints {
            /**
             * Required. The effect of the taint on pods that do not tolerate the taint. Valid effects are NoSchedule, PreferNoSchedule and NoExecute.
             */
            effect: string;
            /**
             * Required. The taint key to be applied to a node.
             */
            key: string;
            /**
             * TimeAdded represents the time at which the taint was added. It is only written for NoExecute taints.
             */
            timeAdded?: string;
            /**
             * The taint value corresponding to the taint key.
             */
            value?: string;
        }

        /**
         * The node this Taint is attached to has the "effect" on any pod that does not tolerate the Taint.
         */
        export interface ProvisionerSpecTaints {
            /**
             * Required. The effect of the taint on pods that do not tolerate the taint. Valid effects are NoSchedule, PreferNoSchedule and NoExecute.
             */
            effect: string;
            /**
             * Required. The taint key to be applied to a node.
             */
            key: string;
            /**
             * TimeAdded represents the time at which the taint was added. It is only written for NoExecute taints.
             */
            timeAdded?: string;
            /**
             * The taint value corresponding to the taint key.
             */
            value?: string;
        }

        /**
         * ProvisionerStatus defines the observed state of Provisioner
         */
        export interface ProvisionerStatus {
            /**
             * Conditions is the set of conditions required for this provisioner to scale its target, and indicates whether or not those conditions are met.
             */
            conditions?: outputs.karpenter.v1alpha5.ProvisionerStatusConditions[];
            /**
             * LastScaleTime is the last time the Provisioner scaled the number of nodes
             */
            lastScaleTime?: string;
            /**
             * Resources is the list of resources that have been provisioned.
             */
            resources?: {[key: string]: number | string};
        }

        /**
         * Condition defines a readiness condition for a Knative resource. See: https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md#typical-status-properties
         */
        export interface ProvisionerStatusConditions {
            /**
             * LastTransitionTime is the last time the condition transitioned from one status to another. We use VolatileTime in place of metav1.Time to exclude this from creating equality.Semantic differences (all other things held constant).
             */
            lastTransitionTime?: string;
            /**
             * A human readable message indicating details about the transition.
             */
            message?: string;
            /**
             * The reason for the condition's last transition.
             */
            reason?: string;
            /**
             * Severity with which to treat failures of this type of condition. When this is not specified, it defaults to Error.
             */
            severity?: string;
            /**
             * Status of the condition, one of True, False, Unknown.
             */
            status: string;
            /**
             * Type of condition.
             */
            type: string;
        }

    }
}
