// *** WARNING: this file was generated by crd2pulumi. ***
// *** Do not edit by hand unless you're certain you know what you are doing! ***

import * as pulumi from "@pulumi/pulumi";
import * as utilities from "../../utilities";

// Export members:
export { LogsInstanceArgs } from "./logsInstance";
export type LogsInstance = import("./logsInstance").LogsInstance;
export const LogsInstance: typeof import("./logsInstance").LogsInstance = null as any;
utilities.lazyLoad(exports, ["LogsInstance"], () => require("./logsInstance"));


const _module = {
    version: utilities.getVersion(),
    construct: (name: string, type: string, urn: string): pulumi.Resource => {
        switch (type) {
            case "kubernetes:monitoring.grafana.com/v1alpha1:LogsInstance":
                return new LogsInstance(name, <any>undefined, { urn })
            default:
                throw new Error(`unknown resource type ${type}`);
        }
    },
};
pulumi.runtime.registerResourceModule("crds", "monitoring.grafana.com/v1alpha1", _module)