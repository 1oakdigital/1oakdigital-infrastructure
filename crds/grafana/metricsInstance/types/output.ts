// *** WARNING: this file was generated by crd2pulumi. ***
// *** Do not edit by hand unless you're certain you know what you are doing! ***

import * as pulumi from "@pulumi/pulumi";
import * as inputs from "../types/input";
import * as outputs from "../types/output";

import * as utilities from "../utilities";

import {ObjectMeta} from "../meta/v1";

export namespace monitoring {
    export namespace v1alpha1 {
        /**
         * Spec holds the specification of the desired behavior for the Metrics instance.
         */
        export interface MetricsInstanceSpec {
            /**
             * AdditionalScrapeConfigs allows specifying a key of a Secret containing additional Grafana Agent Prometheus scrape configurations. SCrape configurations specified are appended to the configurations generated by the Grafana Agent Operator. Job configurations specified must have the form as specified in the official Prometheus documentation: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config. As scrape configs are appended, the user is responsible to make sure it is valid. Note that using this feature may expose the possibility to break upgrades of Grafana Agent. It is advised to review both Grafana Agent and Prometheus release notes to ensure that no incompatible scrape configs are going to break Grafana Agent after the upgrade.
             */
            additionalScrapeConfigs?: outputs.monitoring.v1alpha1.MetricsInstanceSpecAdditionalscrapeconfigs;
            /**
             * MaxWALTime is the maximum amount of time series and asmples may exist in the WAL before being forcibly deleted.
             */
            maxWALTime?: string;
            /**
             * MinWALTime is the minimum amount of time series and samples may exist in the WAL before being considered for deletion.
             */
            minWALTime?: string;
            /**
             * PodMonitorNamespaceSelector are the set of labels to determine which namespaces to watch for PodMonitor discovery. If nil, only checks own namespace.
             */
            podMonitorNamespaceSelector?: outputs.monitoring.v1alpha1.MetricsInstanceSpecPodmonitornamespaceselector;
            /**
             * PodMonitorSelector determines which PodMonitors should be selected for target discovery. Experimental.
             */
            podMonitorSelector?: outputs.monitoring.v1alpha1.MetricsInstanceSpecPodmonitorselector;
            /**
             * ProbeNamespaceSelector are the set of labels to determine which namespaces to watch for Probe discovery. If nil, only checks own namespace.
             */
            probeNamespaceSelector?: outputs.monitoring.v1alpha1.MetricsInstanceSpecProbenamespaceselector;
            /**
             * ProbeSelector determines which Probes should be selected for target discovery.
             */
            probeSelector?: outputs.monitoring.v1alpha1.MetricsInstanceSpecProbeselector;
            /**
             * RemoteFlushDeadline is the deadline for flushing data when an instance shuts down.
             */
            remoteFlushDeadline?: string;
            /**
             * RemoteWrite controls remote_write settings for this instance.
             */
            remoteWrite?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewrite[];
            /**
             * ServiceMonitorNamespaceSelector are the set of labels to determine which namespaces to watch for ServiceMonitor discovery. If nil, only checks own namespace.
             */
            serviceMonitorNamespaceSelector?: outputs.monitoring.v1alpha1.MetricsInstanceSpecServicemonitornamespaceselector;
            /**
             * ServiceMonitorSelector determines which ServiceMonitors should be selected for target discovery.
             */
            serviceMonitorSelector?: outputs.monitoring.v1alpha1.MetricsInstanceSpecServicemonitorselector;
            /**
             * WALTruncateFrequency specifies how frequently the WAL truncation process should run. Higher values causes the WAL to increase and for old series to stay in the WAL for longer, but reduces the chances of data loss when remote_write is failing for longer than the given frequency.
             */
            walTruncateFrequency?: string;
            /**
             * WriteStaleOnShutdown writes staleness markers on shutdown for all series.
             */
            writeStaleOnShutdown?: boolean;
        }

        /**
         * AdditionalScrapeConfigs allows specifying a key of a Secret containing additional Grafana Agent Prometheus scrape configurations. SCrape configurations specified are appended to the configurations generated by the Grafana Agent Operator. Job configurations specified must have the form as specified in the official Prometheus documentation: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#scrape_config. As scrape configs are appended, the user is responsible to make sure it is valid. Note that using this feature may expose the possibility to break upgrades of Grafana Agent. It is advised to review both Grafana Agent and Prometheus release notes to ensure that no incompatible scrape configs are going to break Grafana Agent after the upgrade.
         */
        export interface MetricsInstanceSpecAdditionalscrapeconfigs {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * PodMonitorNamespaceSelector are the set of labels to determine which namespaces to watch for PodMonitor discovery. If nil, only checks own namespace.
         */
        export interface MetricsInstanceSpecPodmonitornamespaceselector {
            /**
             * matchExpressions is a list of label selector requirements. The requirements are ANDed.
             */
            matchExpressions?: outputs.monitoring.v1alpha1.MetricsInstanceSpecPodmonitornamespaceselectorMatchexpressions[];
            /**
             * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
             */
            matchLabels?: {[key: string]: string};
        }

        /**
         * A label selector requirement is a selector that contains values, a key, and an operator that relates the key and values.
         */
        export interface MetricsInstanceSpecPodmonitornamespaceselectorMatchexpressions {
            /**
             * key is the label key that the selector applies to.
             */
            key: string;
            /**
             * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
             */
            operator: string;
            /**
             * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
             */
            values?: string[];
        }

        /**
         * PodMonitorSelector determines which PodMonitors should be selected for target discovery. Experimental.
         */
        export interface MetricsInstanceSpecPodmonitorselector {
            /**
             * matchExpressions is a list of label selector requirements. The requirements are ANDed.
             */
            matchExpressions?: outputs.monitoring.v1alpha1.MetricsInstanceSpecPodmonitorselectorMatchexpressions[];
            /**
             * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
             */
            matchLabels?: {[key: string]: string};
        }

        /**
         * A label selector requirement is a selector that contains values, a key, and an operator that relates the key and values.
         */
        export interface MetricsInstanceSpecPodmonitorselectorMatchexpressions {
            /**
             * key is the label key that the selector applies to.
             */
            key: string;
            /**
             * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
             */
            operator: string;
            /**
             * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
             */
            values?: string[];
        }

        /**
         * ProbeNamespaceSelector are the set of labels to determine which namespaces to watch for Probe discovery. If nil, only checks own namespace.
         */
        export interface MetricsInstanceSpecProbenamespaceselector {
            /**
             * matchExpressions is a list of label selector requirements. The requirements are ANDed.
             */
            matchExpressions?: outputs.monitoring.v1alpha1.MetricsInstanceSpecProbenamespaceselectorMatchexpressions[];
            /**
             * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
             */
            matchLabels?: {[key: string]: string};
        }

        /**
         * A label selector requirement is a selector that contains values, a key, and an operator that relates the key and values.
         */
        export interface MetricsInstanceSpecProbenamespaceselectorMatchexpressions {
            /**
             * key is the label key that the selector applies to.
             */
            key: string;
            /**
             * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
             */
            operator: string;
            /**
             * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
             */
            values?: string[];
        }

        /**
         * ProbeSelector determines which Probes should be selected for target discovery.
         */
        export interface MetricsInstanceSpecProbeselector {
            /**
             * matchExpressions is a list of label selector requirements. The requirements are ANDed.
             */
            matchExpressions?: outputs.monitoring.v1alpha1.MetricsInstanceSpecProbeselectorMatchexpressions[];
            /**
             * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
             */
            matchLabels?: {[key: string]: string};
        }

        /**
         * A label selector requirement is a selector that contains values, a key, and an operator that relates the key and values.
         */
        export interface MetricsInstanceSpecProbeselectorMatchexpressions {
            /**
             * key is the label key that the selector applies to.
             */
            key: string;
            /**
             * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
             */
            operator: string;
            /**
             * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
             */
            values?: string[];
        }

        /**
         * RemoteWriteSpec defines the remote_write configuration for Prometheus.
         */
        export interface MetricsInstanceSpecRemotewrite {
            /**
             * BasicAuth for the URL.
             */
            basicAuth?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteBasicauth;
            /**
             * BearerToken used for remote_write.
             */
            bearerToken?: string;
            /**
             * BearerTokenFile used to read bearer token.
             */
            bearerTokenFile?: string;
            /**
             * Headers is a set of custom HTTP headers to be sent along with each remote_write request. Be aware that any headers set by Grafana Agent itself can't be overwritten.
             */
            headers?: {[key: string]: string};
            /**
             * MetadataConfig configures the sending of series metadata to remote storage.
             */
            metadataConfig?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteMetadataconfig;
            /**
             * Name of the remote_write queue. Must be unique if specified. The name is used in metrics and logging in order to differentiate queues.
             */
            name?: string;
            /**
             * Oauth2 for URL
             */
            oauth2?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteOauth2;
            /**
             * ProxyURL to proxy requests through. Optional.
             */
            proxyUrl?: string;
            /**
             * QueueConfig allows tuning of the remote_write queue parameters.
             */
            queueConfig?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteQueueconfig;
            /**
             * RemoteTimeout is the timeout for requests to the remote_write endpoint.
             */
            remoteTimeout?: string;
            /**
             * SigV4 configures SigV4-based authentication to the remote_write endpoint. Will be used if SigV4 is defined, even with an empty object.
             */
            sigv4?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteSigv4;
            /**
             * TLSConfig to use for remote_write.
             */
            tlsConfig?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteTlsconfig;
            /**
             * URL of the endpoint to send samples to.
             */
            url: string;
            /**
             * WriteRelabelConfigs holds relabel_configs to relabel samples before they are sent to the remote_write endpoint.
             */
            writeRelabelConfigs?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteWriterelabelconfigs[];
        }

        /**
         * BasicAuth for the URL.
         */
        export interface MetricsInstanceSpecRemotewriteBasicauth {
            /**
             * The secret in the service monitor namespace that contains the password for authentication.
             */
            password?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteBasicauthPassword;
            /**
             * The secret in the service monitor namespace that contains the username for authentication.
             */
            username?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteBasicauthUsername;
        }

        /**
         * The secret in the service monitor namespace that contains the password for authentication.
         */
        export interface MetricsInstanceSpecRemotewriteBasicauthPassword {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * The secret in the service monitor namespace that contains the username for authentication.
         */
        export interface MetricsInstanceSpecRemotewriteBasicauthUsername {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * MetadataConfig configures the sending of series metadata to remote storage.
         */
        export interface MetricsInstanceSpecRemotewriteMetadataconfig {
            /**
             * Send enables metric metadata to be sent to remote storage.
             */
            send?: boolean;
            /**
             * SendInterval controls how frequently metric metadata is sent to remote storage.
             */
            sendInterval?: string;
        }

        /**
         * Oauth2 for URL
         */
        export interface MetricsInstanceSpecRemotewriteOauth2 {
            /**
             * The secret or configmap containing the OAuth2 client id
             */
            clientId: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteOauth2Clientid;
            /**
             * The secret containing the OAuth2 client secret
             */
            clientSecret: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteOauth2Clientsecret;
            /**
             * Parameters to append to the token URL
             */
            endpointParams?: {[key: string]: string};
            /**
             * OAuth2 scopes used for the token request
             */
            scopes?: string[];
            /**
             * The URL to fetch the token from
             */
            tokenUrl: string;
        }

        /**
         * The secret or configmap containing the OAuth2 client id
         */
        export interface MetricsInstanceSpecRemotewriteOauth2Clientid {
            /**
             * ConfigMap containing data to use for the targets.
             */
            configMap?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteOauth2ClientidConfigmap;
            /**
             * Secret containing data to use for the targets.
             */
            secret?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteOauth2ClientidSecret;
        }

        /**
         * ConfigMap containing data to use for the targets.
         */
        export interface MetricsInstanceSpecRemotewriteOauth2ClientidConfigmap {
            /**
             * The key to select.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the ConfigMap or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * Secret containing data to use for the targets.
         */
        export interface MetricsInstanceSpecRemotewriteOauth2ClientidSecret {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * The secret containing the OAuth2 client secret
         */
        export interface MetricsInstanceSpecRemotewriteOauth2Clientsecret {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * QueueConfig allows tuning of the remote_write queue parameters.
         */
        export interface MetricsInstanceSpecRemotewriteQueueconfig {
            /**
             * BatchSendDeadline is the maximum time a sample will wait in buffer.
             */
            batchSendDeadline?: string;
            /**
             * Capacity is the number of samples to buffer per shard before we start dropping them.
             */
            capacity?: number;
            /**
             * MaxBackoff is the maximum retry delay.
             */
            maxBackoff?: string;
            /**
             * MaxRetries is the maximum number of times to retry a batch on recoverable errors.
             */
            maxRetries?: number;
            /**
             * MaxSamplesPerSend is the maximum number of samples per send.
             */
            maxSamplesPerSend?: number;
            /**
             * MaxShards is the maximum number of shards, i.e. amount of concurrency.
             */
            maxShards?: number;
            /**
             * MinBackoff is the initial retry delay. Gets doubled for every retry.
             */
            minBackoff?: string;
            /**
             * MinShards is the minimum number of shards, i.e. amount of concurrency.
             */
            minShards?: number;
            /**
             * RetryOnRateLimit retries requests when encountering rate limits.
             */
            retryOnRateLimit?: boolean;
        }

        /**
         * SigV4 configures SigV4-based authentication to the remote_write endpoint. Will be used if SigV4 is defined, even with an empty object.
         */
        export interface MetricsInstanceSpecRemotewriteSigv4 {
            /**
             * AccessKey holds the secret of the AWS API access key to use for signing. If not provided, The environment variable AWS_ACCESS_KEY_ID is used.
             */
            accessKey?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteSigv4Accesskey;
            /**
             * Profile is the named AWS profile to use for authentication.
             */
            profile?: string;
            /**
             * Region of the AWS endpoint. If blank, the region from the default credentials chain is used.
             */
            region?: string;
            /**
             * RoleARN is the AWS Role ARN to use for authentication, as an alternative for using the AWS API keys.
             */
            roleARN?: string;
            /**
             * SecretKey of the AWS API to use for signing. If blank, the environment variable AWS_SECRET_ACCESS_KEY is used.
             */
            secretKey?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteSigv4Secretkey;
        }

        /**
         * AccessKey holds the secret of the AWS API access key to use for signing. If not provided, The environment variable AWS_ACCESS_KEY_ID is used.
         */
        export interface MetricsInstanceSpecRemotewriteSigv4Accesskey {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * SecretKey of the AWS API to use for signing. If blank, the environment variable AWS_SECRET_ACCESS_KEY is used.
         */
        export interface MetricsInstanceSpecRemotewriteSigv4Secretkey {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * TLSConfig to use for remote_write.
         */
        export interface MetricsInstanceSpecRemotewriteTlsconfig {
            /**
             * Struct containing the CA cert to use for the targets.
             */
            ca?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteTlsconfigCa;
            /**
             * Path to the CA cert in the Prometheus container to use for the targets.
             */
            caFile?: string;
            /**
             * Struct containing the client cert file for the targets.
             */
            cert?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteTlsconfigCert;
            /**
             * Path to the client cert file in the Prometheus container for the targets.
             */
            certFile?: string;
            /**
             * Disable target certificate validation.
             */
            insecureSkipVerify?: boolean;
            /**
             * Path to the client key file in the Prometheus container for the targets.
             */
            keyFile?: string;
            /**
             * Secret containing the client key file for the targets.
             */
            keySecret?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteTlsconfigKeysecret;
            /**
             * Used to verify the hostname for the targets.
             */
            serverName?: string;
        }

        /**
         * Struct containing the CA cert to use for the targets.
         */
        export interface MetricsInstanceSpecRemotewriteTlsconfigCa {
            /**
             * ConfigMap containing data to use for the targets.
             */
            configMap?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteTlsconfigCaConfigmap;
            /**
             * Secret containing data to use for the targets.
             */
            secret?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteTlsconfigCaSecret;
        }

        /**
         * ConfigMap containing data to use for the targets.
         */
        export interface MetricsInstanceSpecRemotewriteTlsconfigCaConfigmap {
            /**
             * The key to select.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the ConfigMap or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * Secret containing data to use for the targets.
         */
        export interface MetricsInstanceSpecRemotewriteTlsconfigCaSecret {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * Struct containing the client cert file for the targets.
         */
        export interface MetricsInstanceSpecRemotewriteTlsconfigCert {
            /**
             * ConfigMap containing data to use for the targets.
             */
            configMap?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteTlsconfigCertConfigmap;
            /**
             * Secret containing data to use for the targets.
             */
            secret?: outputs.monitoring.v1alpha1.MetricsInstanceSpecRemotewriteTlsconfigCertSecret;
        }

        /**
         * ConfigMap containing data to use for the targets.
         */
        export interface MetricsInstanceSpecRemotewriteTlsconfigCertConfigmap {
            /**
             * The key to select.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the ConfigMap or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * Secret containing data to use for the targets.
         */
        export interface MetricsInstanceSpecRemotewriteTlsconfigCertSecret {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * Secret containing the client key file for the targets.
         */
        export interface MetricsInstanceSpecRemotewriteTlsconfigKeysecret {
            /**
             * The key of the secret to select from.  Must be a valid secret key.
             */
            key: string;
            /**
             * Name of the referent. More info: https://kubernetes.io/docs/concepts/overview/working-with-objects/names/#names TODO: Add other useful fields. apiVersion, kind, uid?
             */
            name?: string;
            /**
             * Specify whether the Secret or its key must be defined
             */
            optional?: boolean;
        }

        /**
         * RelabelConfig allows dynamic rewriting of the label set, being applied to samples before ingestion. It defines `<metric_relabel_configs>`-section of Prometheus configuration. More info: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#metric_relabel_configs
         */
        export interface MetricsInstanceSpecRemotewriteWriterelabelconfigs {
            /**
             * Action to perform based on regex matching. Default is 'replace'
             */
            action?: string;
            /**
             * Modulus to take of the hash of the source label values.
             */
            modulus?: number;
            /**
             * Regular expression against which the extracted value is matched. Default is '(.*)'
             */
            regex?: string;
            /**
             * Replacement value against which a regex replace is performed if the regular expression matches. Regex capture groups are available. Default is '$1'
             */
            replacement?: string;
            /**
             * Separator placed between concatenated source label values. default is ';'.
             */
            separator?: string;
            /**
             * The source labels select values from existing labels. Their content is concatenated using the configured separator and matched against the configured regular expression for the replace, keep, and drop actions.
             */
            sourceLabels?: string[];
            /**
             * Label to which the resulting value is written in a replace action. It is mandatory for replace actions. Regex capture groups are available.
             */
            targetLabel?: string;
        }
        /**
         * metricsInstanceSpecRemotewriteWriterelabelconfigsProvideDefaults sets the appropriate defaults for MetricsInstanceSpecRemotewriteWriterelabelconfigs
         */
        export function metricsInstanceSpecRemotewriteWriterelabelconfigsProvideDefaults(val: MetricsInstanceSpecRemotewriteWriterelabelconfigs): MetricsInstanceSpecRemotewriteWriterelabelconfigs {
            return {
                ...val,
                action: (val.action) ?? "replace",
            };
        }

        /**
         * ServiceMonitorNamespaceSelector are the set of labels to determine which namespaces to watch for ServiceMonitor discovery. If nil, only checks own namespace.
         */
        export interface MetricsInstanceSpecServicemonitornamespaceselector {
            /**
             * matchExpressions is a list of label selector requirements. The requirements are ANDed.
             */
            matchExpressions?: outputs.monitoring.v1alpha1.MetricsInstanceSpecServicemonitornamespaceselectorMatchexpressions[];
            /**
             * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
             */
            matchLabels?: {[key: string]: string};
        }

        /**
         * A label selector requirement is a selector that contains values, a key, and an operator that relates the key and values.
         */
        export interface MetricsInstanceSpecServicemonitornamespaceselectorMatchexpressions {
            /**
             * key is the label key that the selector applies to.
             */
            key: string;
            /**
             * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
             */
            operator: string;
            /**
             * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
             */
            values?: string[];
        }

        /**
         * ServiceMonitorSelector determines which ServiceMonitors should be selected for target discovery.
         */
        export interface MetricsInstanceSpecServicemonitorselector {
            /**
             * matchExpressions is a list of label selector requirements. The requirements are ANDed.
             */
            matchExpressions?: outputs.monitoring.v1alpha1.MetricsInstanceSpecServicemonitorselectorMatchexpressions[];
            /**
             * matchLabels is a map of {key,value} pairs. A single {key,value} in the matchLabels map is equivalent to an element of matchExpressions, whose key field is "key", the operator is "In", and the values array contains only "value". The requirements are ANDed.
             */
            matchLabels?: {[key: string]: string};
        }

        /**
         * A label selector requirement is a selector that contains values, a key, and an operator that relates the key and values.
         */
        export interface MetricsInstanceSpecServicemonitorselectorMatchexpressions {
            /**
             * key is the label key that the selector applies to.
             */
            key: string;
            /**
             * operator represents a key's relationship to a set of values. Valid operators are In, NotIn, Exists and DoesNotExist.
             */
            operator: string;
            /**
             * values is an array of string values. If the operator is In or NotIn, the values array must be non-empty. If the operator is Exists or DoesNotExist, the values array must be empty. This array is replaced during a strategic merge patch.
             */
            values?: string[];
        }

    }
}
