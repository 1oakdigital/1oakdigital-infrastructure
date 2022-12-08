// *** WARNING: this file was generated by crd2pulumi. ***
// *** Do not edit by hand unless you're certain you know what you are doing! ***

import * as pulumi from "@pulumi/pulumi";
import * as utilities from "../../utilities";

// Export members:
export { AlertProviderArgs } from "./alertProvider";
export type AlertProvider = import("./alertProvider").AlertProvider;
export const AlertProvider: typeof import("./alertProvider").AlertProvider = null as any;
utilities.lazyLoad(exports, ["AlertProvider"], () => require("./alertProvider"));

export { CanaryArgs } from "./canary";
export type Canary = import("./canary").Canary;
export const Canary: typeof import("./canary").Canary = null as any;
utilities.lazyLoad(exports, ["Canary"], () => require("./canary"));

export { MetricTemplateArgs } from "./metricTemplate";
export type MetricTemplate = import("./metricTemplate").MetricTemplate;
export const MetricTemplate: typeof import("./metricTemplate").MetricTemplate = null as any;
utilities.lazyLoad(exports, ["MetricTemplate"], () => require("./metricTemplate"));


const _module = {
    version: utilities.getVersion(),
    construct: (name: string, type: string, urn: string): pulumi.Resource => {
        switch (type) {
            case "kubernetes:flagger.app/v1beta1:AlertProvider":
                return new AlertProvider(name, <any>undefined, { urn })
            case "kubernetes:flagger.app/v1beta1:Canary":
                return new Canary(name, <any>undefined, { urn })
            case "kubernetes:flagger.app/v1beta1:MetricTemplate":
                return new MetricTemplate(name, <any>undefined, { urn })
            default:
                throw new Error(`unknown resource type ${type}`);
        }
    },
};
pulumi.runtime.registerResourceModule("crds", "flagger.app/v1beta1", _module)