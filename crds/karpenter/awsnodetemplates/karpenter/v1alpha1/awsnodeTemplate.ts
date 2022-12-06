// *** WARNING: this file was generated by crd2pulumi. ***
// *** Do not edit by hand unless you're certain you know what you are doing! ***

import * as pulumi from "@pulumi/pulumi";
import * as inputs from "../../types/input";
import * as outputs from "../../types/output";
import * as utilities from "../../utilities";

import {ObjectMeta} from "../../meta/v1";

/**
 * AWSNodeTemplate is the Schema for the AWSNodeTemplate API
 */
export class AWSNodeTemplate extends pulumi.CustomResource {
    /**
     * Get an existing AWSNodeTemplate resource's state with the given name, ID, and optional extra
     * properties used to qualify the lookup.
     *
     * @param name The _unique_ name of the resulting resource.
     * @param id The _unique_ provider ID of the resource to lookup.
     * @param opts Optional settings to control the behavior of the CustomResource.
     */
    public static get(name: string, id: pulumi.Input<pulumi.ID>, opts?: pulumi.CustomResourceOptions): AWSNodeTemplate {
        return new AWSNodeTemplate(name, undefined as any, { ...opts, id: id });
    }

    /** @internal */
    public static readonly __pulumiType = 'kubernetes:karpenter.k8s.aws/v1alpha1:AWSNodeTemplate';

    /**
     * Returns true if the given object is an instance of AWSNodeTemplate.  This is designed to work even
     * when multiple copies of the Pulumi SDK have been loaded into the same process.
     */
    public static isInstance(obj: any): obj is AWSNodeTemplate {
        if (obj === undefined || obj === null) {
            return false;
        }
        return obj['__pulumiType'] === AWSNodeTemplate.__pulumiType;
    }

    public readonly apiVersion!: pulumi.Output<"karpenter.k8s.aws/v1alpha1" | undefined>;
    public readonly kind!: pulumi.Output<"AWSNodeTemplate" | undefined>;
    public readonly metadata!: pulumi.Output<ObjectMeta | undefined>;
    /**
     * AWSNodeTemplateSpec is the top level specification for the AWS Karpenter Provider. This will contain configuration necessary to launch instances in AWS.
     */
    public readonly spec!: pulumi.Output<outputs.karpenter.v1alpha1.AWSNodeTemplateSpec | undefined>;

    /**
     * Create a AWSNodeTemplate resource with the given unique name, arguments, and options.
     *
     * @param name The _unique_ name of the resource.
     * @param args The arguments to use to populate this resource's properties.
     * @param opts A bag of options that control this resource's behavior.
     */
    constructor(name: string, args?: AWSNodeTemplateArgs, opts?: pulumi.CustomResourceOptions) {
        let resourceInputs: pulumi.Inputs = {};
        opts = opts || {};
        if (!opts.id) {
            resourceInputs["apiVersion"] = "karpenter.k8s.aws/v1alpha1";
            resourceInputs["kind"] = "AWSNodeTemplate";
            resourceInputs["metadata"] = args ? args.metadata : undefined;
            resourceInputs["spec"] = args ? args.spec : undefined;
        } else {
            resourceInputs["apiVersion"] = undefined /*out*/;
            resourceInputs["kind"] = undefined /*out*/;
            resourceInputs["metadata"] = undefined /*out*/;
            resourceInputs["spec"] = undefined /*out*/;
        }
        opts = pulumi.mergeOptions(utilities.resourceOptsDefaults(), opts);
        super(AWSNodeTemplate.__pulumiType, name, resourceInputs, opts);
    }
}

/**
 * The set of arguments for constructing a AWSNodeTemplate resource.
 */
export interface AWSNodeTemplateArgs {
    apiVersion?: pulumi.Input<"karpenter.k8s.aws/v1alpha1">;
    kind?: pulumi.Input<"AWSNodeTemplate">;
    metadata?: pulumi.Input<ObjectMeta>;
    /**
     * AWSNodeTemplateSpec is the top level specification for the AWS Karpenter Provider. This will contain configuration necessary to launch instances in AWS.
     */
    spec?: pulumi.Input<inputs.karpenter.v1alpha1.AWSNodeTemplateSpecArgs>;
}
