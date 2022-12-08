// *** WARNING: this file was generated by crd2pulumi. ***
// *** Do not edit by hand unless you're certain you know what you are doing! ***

import * as pulumi from "@pulumi/pulumi";
import * as inputs from "../types/input";
import * as outputs from "../types/output";

import * as utilities from "../utilities";

import {ObjectMeta} from "../meta/v1";

export namespace monitoring {
    export namespace v1 {
        /**
         * Specification of desired Service selection for target discovery by Prometheus.
         */
        export interface ServiceMonitorSpecArgs {
            /**
             * A list of endpoints allowed as part of this ServiceMonitor.
             */
            endpoints: pulumi.Input<pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsArgs>[]>;
            /**
             * Chooses the label of the Kubernetes `Endpoints`. Its value will be used for the `job`-label's value of the created metrics. 
             *  Default & fallback value: the name of the respective Kubernetes `Endpoint`.
             */
            jobLabel?: pulumi.Input<string>;
            /**
             * Per-scrape limit on number of labels that will be accepted for a sample. Only valid in Prometheus versions 2.27.0 and newer.
             */
            labelLimit?: pulumi.Input<number>;
            /**
             * Per-scrape limit on length of labels name that will be accepted for a sample. Only valid in Prometheus versions 2.27.0 and newer.
             */
            labelNameLengthLimit?: pulumi.Input<number>;
            /**
             * Per-scrape limit on length of labels value that will be accepted for a sample. Only valid in Prometheus versions 2.27.0 and newer.
             */
            labelValueLengthLimit?: pulumi.Input<number>;
            /**
             * Selector to select which namespaces the Kubernetes Endpoints objects are discovered from.
             */
            namespaceSelector?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecNamespaceselectorArgs>;
            /**
             * PodTargetLabels transfers labels on the Kubernetes `Pod` onto the created metrics.
             */
            podTargetLabels?: pulumi.Input<pulumi.Input<string>[]>;
            /**
             * SampleLimit defines per-scrape limit on number of scraped samples that will be accepted.
             */
            sampleLimit?: pulumi.Input<number>;
            /**
             * Selector to select Endpoints objects.
             */
            selector: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecSelectorArgs>;
            /**
             * TargetLabels transfers labels from the Kubernetes `Service` onto the created metrics.
             */
            targetLabels?: pulumi.Input<pulumi.Input<string>[]>;
            /**
             * TargetLimit defines a limit on the number of scraped targets that will be accepted.
             */
            targetLimit?: pulumi.Input<number>;
        }

        /**
         * Endpoint defines a scrapeable endpoint serving Prometheus metrics.
         */
        export interface ServiceMonitorSpecEndpointsArgs {
            /**
             * Authorization section for this endpoint
             */
            authorization?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsAuthorizationArgs>;
            /**
             * BasicAuth allow an endpoint to authenticate over basic authentication More info: https://prometheus.io/docs/operating/configuration/#endpoints
             */
            basicAuth?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsBasicauthArgs>;
            /**
             * File to read bearer token for scraping targets.
             */
            bearerTokenFile?: pulumi.Input<string>;
            /**
             * Secret to mount to read bearer token for scraping targets. The secret needs to be in the same namespace as the service monitor and accessible by the Prometheus Operator.
             */
            bearerTokenSecret?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsBearertokensecretArgs>;
            /**
             * FollowRedirects configures whether scrape requests follow HTTP 3xx redirects.
             */
            followRedirects?: pulumi.Input<boolean>;
            /**
             * HonorLabels chooses the metric's labels on collisions with target labels.
             */
            honorLabels?: pulumi.Input<boolean>;
            /**
             * HonorTimestamps controls whether Prometheus respects the timestamps present in scraped data.
             */
            honorTimestamps?: pulumi.Input<boolean>;
            /**
             * Interval at which metrics should be scraped
             */
            interval?: pulumi.Input<string>;
            /**
             * MetricRelabelConfigs to apply to samples before ingestion.
             */
            metricRelabelings?: pulumi.Input<pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsMetricrelabelingsArgs>[]>;
            /**
             * OAuth2 for the URL. Only valid in Prometheus versions 2.27.0 and newer.
             */
            oauth2?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsOauth2Args>;
            /**
             * Optional HTTP URL parameters
             */
            params?: pulumi.Input<{[key: string]: pulumi.Input<pulumi.Input<string>[]>}>;
            /**
             * HTTP path to scrape for metrics.
             */
            path?: pulumi.Input<string>;
            /**
             * Name of the service port this endpoint refers to. Mutually exclusive with targetPort.
             */
            port?: pulumi.Input<string>;
            /**
             * ProxyURL eg http://proxyserver:2195 Directs scrapes to proxy through this endpoint.
             */
            proxyUrl?: pulumi.Input<string>;
            /**
             * RelabelConfigs to apply to samples before scraping. Prometheus Operator automatically adds relabelings for a few standard Kubernetes fields. The original scrape job's name is available via the `__tmp_prometheus_job_name` label. More info: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#relabel_config
             */
            relabelings?: pulumi.Input<pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsRelabelingsArgs>[]>;
            /**
             * HTTP scheme to use for scraping.
             */
            scheme?: pulumi.Input<string>;
            /**
             * Timeout after which the scrape is ended
             */
            scrapeTimeout?: pulumi.Input<string>;
            /**
             * Name or number of the target port of the Pod behind the Service, the port must be specified with container port property. Mutually exclusive with port.
             */
            targetPort?: pulumi.Input<number | string>;
            /**
             * TLS configuration to use when scraping the endpoint
             */
            tlsConfig?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsTlsconfigArgs>;
        }

        /**
         * Authorization section for this endpoint
         */
        export interface ServiceMonitorSpecEndpointsAuthorizationArgs {
            /**
             * The secret's key that contains the credentials of the request
             */
            credentials?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsAuthorizationCredentialsArgs>;
            /**
             * Set the authentication type. Defaults to Bearer, Basic will cause an error
             */
            type?: pulumi.Input<string>;
        }

        /**
         * The secret's key that contains the credentials of the request
         */
        export interface ServiceMonitorSpecEndpointsAuthorizationCredentialsArgs {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * BasicAuth allow an endpoint to authenticate over basic authentication More info: https://prometheus.io/docs/operating/configuration/#endpoints
         */
        export interface ServiceMonitorSpecEndpointsBasicauthArgs {
            /**
             * The secret in the service monitor namespace that contains the password for authentication.
             */
            password?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsBasicauthPasswordArgs>;
            /**
             * The secret in the service monitor namespace that contains the username for authentication.
             */
            username?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsBasicauthUsernameArgs>;
        }

        /**
         * The secret in the service monitor namespace that contains the password for authentication.
         */
        export interface ServiceMonitorSpecEndpointsBasicauthPasswordArgs {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * The secret in the service monitor namespace that contains the username for authentication.
         */
        export interface ServiceMonitorSpecEndpointsBasicauthUsernameArgs {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * Secret to mount to read bearer token for scraping targets. The secret needs to be in the same namespace as the service monitor and accessible by the Prometheus Operator.
         */
        export interface ServiceMonitorSpecEndpointsBearertokensecretArgs {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * RelabelConfig allows dynamic rewriting of the label set, being applied to samples before ingestion. It defines `<metric_relabel_configs>`-section of Prometheus configuration. More info: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#metric_relabel_configs
         */
        export interface ServiceMonitorSpecEndpointsMetricrelabelingsArgs {
            /**
             * Action to perform based on regex matching. Default is 'replace'
             */
            action?: pulumi.Input<string>;
            /**
             * Modulus to take of the hash of the source label values.
             */
            modulus?: pulumi.Input<number>;
            /**
             * Regular expression against which the extracted value is matched. Default is '(.*)'
             */
            regex?: pulumi.Input<string>;
            /**
             * Replacement value against which a regex replace is performed if the regular expression matches. Regex capture groups are available. Default is '$1'
             */
            replacement?: pulumi.Input<string>;
            /**
             * Separator placed between concatenated source label values. default is ';'.
             */
            separator?: pulumi.Input<string>;
            /**
             * The source labels select values from existing labels. Their content is concatenated using the configured separator and matched against the configured regular expression for the replace, keep, and drop actions.
             */
            sourceLabels?: pulumi.Input<pulumi.Input<string>[]>;
            /**
             * Label to which the resulting value is written in a replace action. It is mandatory for replace actions. Regex capture groups are available.
             */
            targetLabel?: pulumi.Input<string>;
        }
        /**
         * serviceMonitorSpecEndpointsMetricrelabelingsArgsProvideDefaults sets the appropriate defaults for ServiceMonitorSpecEndpointsMetricrelabelingsArgs
         */
        export function serviceMonitorSpecEndpointsMetricrelabelingsArgsProvideDefaults(val: ServiceMonitorSpecEndpointsMetricrelabelingsArgs): ServiceMonitorSpecEndpointsMetricrelabelingsArgs {
            return {
                ...val,
                action: (val.action) ?? "replace",
            };
        }

        /**
         * OAuth2 for the URL. Only valid in Prometheus versions 2.27.0 and newer.
         */
        export interface ServiceMonitorSpecEndpointsOauth2Args {
            /**
             * The secret or configmap containing the OAuth2 client id
             */
            clientId: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsOauth2ClientidArgs>;
            /**
             * The secret containing the OAuth2 client secret
             */
            clientSecret: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsOauth2ClientsecretArgs>;
            /**
             * Parameters to append to the token URL
             */
            endpointParams?: pulumi.Input<{[key: string]: pulumi.Input<string>}>;
            /**
             * OAuth2 scopes used for the token request
             */
            scopes?: pulumi.Input<pulumi.Input<string>[]>;
            /**
             * The URL to fetch the token from
             */
            tokenUrl: pulumi.Input<string>;
        }

        /**
         * The secret or configmap containing the OAuth2 client id
         */
        export interface ServiceMonitorSpecEndpointsOauth2ClientidArgs {
            /**
             * ConfigMap containing data to use for the targets.
             */
            configMap?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsOauth2ClientidConfigmapArgs>;
            /**
             * Secret containing data to use for the targets.
             */
            secret?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsOauth2ClientidSecretArgs>;
        }

        /**
         * ConfigMap containing data to use for the targets.
         */
        export interface ServiceMonitorSpecEndpointsOauth2ClientidConfigmapArgs {
            /**
             * The key to select.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the ConfigMap or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * Secret containing data to use for the targets.
         */
        export interface ServiceMonitorSpecEndpointsOauth2ClientidSecretArgs {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * The secret containing the OAuth2 client secret
         */
        export interface ServiceMonitorSpecEndpointsOauth2ClientsecretArgs {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * RelabelConfig allows dynamic rewriting of the label set, being applied to samples before ingestion. It defines `<metric_relabel_configs>`-section of Prometheus configuration. More info: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#metric_relabel_configs
         */
        export interface ServiceMonitorSpecEndpointsRelabelingsArgs {
            /**
             * Action to perform based on regex matching. Default is 'replace'
             */
            action?: pulumi.Input<string>;
            /**
             * Modulus to take of the hash of the source label values.
             */
            modulus?: pulumi.Input<number>;
            /**
             * Regular expression against which the extracted value is matched. Default is '(.*)'
             */
            regex?: pulumi.Input<string>;
            /**
             * Replacement value against which a regex replace is performed if the regular expression matches. Regex capture groups are available. Default is '$1'
             */
            replacement?: pulumi.Input<string>;
            /**
             * Separator placed between concatenated source label values. default is ';'.
             */
            separator?: pulumi.Input<string>;
            /**
             * The source labels select values from existing labels. Their content is concatenated using the configured separator and matched against the configured regular expression for the replace, keep, and drop actions.
             */
            sourceLabels?: pulumi.Input<pulumi.Input<string>[]>;
            /**
             * Label to which the resulting value is written in a replace action. It is mandatory for replace actions. Regex capture groups are available.
             */
            targetLabel?: pulumi.Input<string>;
        }
        /**
         * serviceMonitorSpecEndpointsRelabelingsArgsProvideDefaults sets the appropriate defaults for ServiceMonitorSpecEndpointsRelabelingsArgs
         */
        export function serviceMonitorSpecEndpointsRelabelingsArgsProvideDefaults(val: ServiceMonitorSpecEndpointsRelabelingsArgs): ServiceMonitorSpecEndpointsRelabelingsArgs {
            return {
                ...val,
                action: (val.action) ?? "replace",
            };
        }

        /**
         * TLS configuration to use when scraping the endpoint
         */
        export interface ServiceMonitorSpecEndpointsTlsconfigArgs {
            /**
             * Struct containing the CA cert to use for the targets.
             */
            ca?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsTlsconfigCaArgs>;
            /**
             * Path to the CA cert in the Prometheus container to use for the targets.
             */
            caFile?: pulumi.Input<string>;
            /**
             * Struct containing the client cert file for the targets.
             */
            cert?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsTlsconfigCertArgs>;
            /**
             * Path to the client cert file in the Prometheus container for the targets.
             */
            certFile?: pulumi.Input<string>;
            /**
             * Disable target certificate validation.
             */
            insecureSkipVerify?: pulumi.Input<boolean>;
            /**
             * Path to the client key file in the Prometheus container for the targets.
             */
            keyFile?: pulumi.Input<string>;
            /**
             * Secret containing the client key file for the targets.
             */
            keySecret?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsTlsconfigKeysecretArgs>;
            /**
             * Used to verify the hostname for the targets.
             */
            serverName?: pulumi.Input<string>;
        }

        /**
         * Struct containing the CA cert to use for the targets.
         */
        export interface ServiceMonitorSpecEndpointsTlsconfigCaArgs {
            /**
             * ConfigMap containing data to use for the targets.
             */
            configMap?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsTlsconfigCaConfigmapArgs>;
            /**
             * Secret containing data to use for the targets.
             */
            secret?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsTlsconfigCaSecretArgs>;
        }

        /**
         * ConfigMap containing data to use for the targets.
         */
        export interface ServiceMonitorSpecEndpointsTlsconfigCaConfigmapArgs {
            /**
             * The key to select.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the ConfigMap or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * Secret containing data to use for the targets.
         */
        export interface ServiceMonitorSpecEndpointsTlsconfigCaSecretArgs {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * Struct containing the client cert file for the targets.
         */
        export interface ServiceMonitorSpecEndpointsTlsconfigCertArgs {
            /**
             * ConfigMap containing data to use for the targets.
             */
            configMap?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsTlsconfigCertConfigmapArgs>;
            /**
             * Secret containing data to use for the targets.
             */
            secret?: pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecEndpointsTlsconfigCertSecretArgs>;
        }

        /**
         * ConfigMap containing data to use for the targets.
         */
        export interface ServiceMonitorSpecEndpointsTlsconfigCertConfigmapArgs {
            /**
             * The key to select.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the ConfigMap or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * Secret containing data to use for the targets.
         */
        export interface ServiceMonitorSpecEndpointsTlsconfigCertSecretArgs {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * Secret containing the client key file for the targets.
         */
        export interface ServiceMonitorSpecEndpointsTlsconfigKeysecretArgs {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: pulumi.Input<string>;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: pulumi.Input<string>;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: pulumi.Input<boolean>;
        }

        /**
         * Selector to select which namespaces the Kubernetes Endpoints objects are discovered from.
         */
        export interface ServiceMonitorSpecNamespaceselectorArgs {
            /**
             * Boolean describing whether all namespaces are selected in contrast to a list restricting them.
             */
            any?: pulumi.Input<boolean>;
            /**
             * List of namespace names to select from.
             */
            matchNames?: pulumi.Input<pulumi.Input<string>[]>;
        }

        /**
         * Selector to select Endpoints objects.
         */
        export interface ServiceMonitorSpecSelectorArgs {
            /**
             * matchExpressions is a list of label selector requirements. The requirements are ANDed.
             */
            matchExpressions?: pulumi.Input<pulumi.Input<inputs.monitoring.v1.ServiceMonitorSpecSelectorMatchexpressionsArgs>[]>;
            /**
             * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
             */
            matchLabels?: pulumi.Input<{[key: string]: pulumi.Input<string>}>;
        }

        /**
         * A label selector requirement is a selector that contains values, a key, and an operator that relates the key and values.
         */
        export interface ServiceMonitorSpecSelectorMatchexpressionsArgs {
            /**
             * key is the label key that the selector applies to.
             */
            key: pulumi.Input<string>;
            /**
             * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
             */
            operator: pulumi.Input<string>;
            /**
             * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
             */
            values?: pulumi.Input<pulumi.Input<string>[]>;
        }

    }
}