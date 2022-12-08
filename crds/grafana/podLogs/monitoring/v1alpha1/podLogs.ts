// *** WARNING: this file was generated by crd2pulumi. ***
// *** Do not edit by hand unless you're certain you know what you are doing! ***

import * as pulumi from "@pulumi/pulumi";
import * as inputs from "../../types/input";
import * as outputs from "../../types/output";
import * as utilities from "../../utilities";

import {ObjectMeta} from "../../meta/v1";

/**
 * PodLogs defines how to collect logs for a pod.
 */
export class PodLogs extends pulumi.CustomResource {
    /**
     * Get an existing PodLogs resource's state with the given name, ID, and optional extra
     * properties used to qualify the lookup.
     *
     * @param name The _unique_ name of the resulting resource.
     * @param id The _unique_ provider ID of the resource to lookup.
     * @param opts Optional settings to control the behavior of the CustomResource.
     */
    public static get(name: string, id: pulumi.Input<pulumi.ID>, opts?: pulumi.CustomResourceOptions): PodLogs {
        return new PodLogs(name, undefined as any, { ...opts, id: id });
    }

    /** @internal */
    public static readonly __pulumiType = 'kubernetes:monitoring.grafana.com/v1alpha1:PodLogs';

    /**
     * Returns true if the given object is an instance of PodLogs.  This is designed to work even
     * when multiple copies of the Pulumi SDK have been loaded into the same process.
     */
    public static isInstance(obj: any): obj is PodLogs {
        if (obj === undefined || obj === null) {
            return false;
        }
        return obj['__pulumiType'] === PodLogs.__pulumiType;
    }

    public readonly apiVersion!: pulumi.Output<"monitoring.grafana.com/v1alpha1" | undefined>;
    public readonly kind!: pulumi.Output<"PodLogs" | undefined>;
    public readonly metadata!: pulumi.Output<ObjectMeta | undefined>;
    /**
     * Spec holds the specification of the desired behavior for the PodLogs.
     */
    public readonly spec!: pulumi.Output<outputs.monitoring.v1alpha1.PodLogsSpec | undefined>;

    /**
     * Create a PodLogs resource with the given unique name, arguments, and options.
     *
     * @param name The _unique_ name of the resource.
     * @param args The arguments to use to populate this resource's properties.
     * @param opts A bag of options that control this resource's behavior.
     */
    constructor(name: string, args?: PodLogsArgs, opts?: pulumi.CustomResourceOptions) {
        let resourceInputs: pulumi.Inputs = {};
        opts = opts || {};
        if (!opts.id) {
            resourceInputs["apiVersion"] = "monitoring.grafana.com/v1alpha1";
            resourceInputs["kind"] = "PodLogs";
            resourceInputs["metadata"] = args ? args.metadata : undefined;
            resourceInputs["spec"] = args ? args.spec : undefined;
        } else {
            resourceInputs["apiVersion"] = undefined /*out*/;
            resourceInputs["kind"] = undefined /*out*/;
            resourceInputs["metadata"] = undefined /*out*/;
            resourceInputs["spec"] = undefined /*out*/;
        }
        opts = pulumi.mergeOptions(utilities.resourceOptsDefaults(), opts);
        super(PodLogs.__pulumiType, name, resourceInputs, opts);
    }
}

/**
 * The set of arguments for constructing a PodLogs resource.
 */
export interface PodLogsArgs {
    apiVersion?: pulumi.Input<"monitoring.grafana.com/v1alpha1">;
    kind?: pulumi.Input<"PodLogs">;
    metadata?: pulumi.Input<ObjectMeta>;
    /**
     * Spec holds the specification of the desired behavior for the PodLogs.
     */
    spec?: pulumi.Input<inputs.monitoring.v1alpha1.PodLogsSpecArgs>;
}