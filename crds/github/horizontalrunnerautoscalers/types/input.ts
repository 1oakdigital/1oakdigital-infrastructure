// *** WARNING: this file was generated by crd2pulumi. ***
// *** Do not edit by hand unless you're certain you know what you are doing! ***

import * as pulumi from "@pulumi/pulumi";
import * as inputs from "../types/input";
import * as outputs from "../types/output";

import {ObjectMeta} from "../meta/v1";

export namespace actions {
    export namespace v1alpha1 {
        /**
         * HorizontalRunnerAutoscalerSpec defines the desired state of HorizontalRunnerAutoscaler
         */
        export interface HorizontalRunnerAutoscalerSpecArgs {
            capacityReservations?: pulumi.Input<pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecCapacityreservationsArgs>[]>;
            githubAPICredentialsFrom?: pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecGithubapicredentialsfromArgs>;
            /**
             * MaxReplicas is the maximum number of replicas the deployment is allowed to scale
             */
            maxReplicas?: pulumi.Input<number>;
            /**
             * Metrics is the collection of various metric targets to calculate desired number of runners
             */
            metrics?: pulumi.Input<pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecMetricsArgs>[]>;
            /**
             * MinReplicas is the minimum number of replicas the deployment is allowed to scale
             */
            minReplicas?: pulumi.Input<number>;
            /**
             * ScaleDownDelaySecondsAfterScaleUp is the approximate delay for a scale down followed by a scale up Used to prevent flapping (down->up->down->... loop)
             */
            scaleDownDelaySecondsAfterScaleOut?: pulumi.Input<number>;
            /**
             * ScaleTargetRef sis the reference to scaled resource like RunnerDeployment
             */
            scaleTargetRef?: pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecScaletargetrefArgs>;
            /**
             * ScaleUpTriggers is an experimental feature to increase the desired replicas by 1 on each webhook requested received by the webhookBasedAutoscaler. 
             *  This feature requires you to also enable and deploy the webhookBasedAutoscaler onto your cluster. 
             *  Note that the added runners remain until the next sync period at least, and they may or may not be used by GitHub Actions depending on the timing. They are intended to be used to gain "resource slack" immediately after you receive a webhook from GitHub, so that you can loosely expect MinReplicas runners to be always available.
             */
            scaleUpTriggers?: pulumi.Input<pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecScaleuptriggersArgs>[]>;
            /**
             * ScheduledOverrides is the list of ScheduledOverride. It can be used to override a few fields of HorizontalRunnerAutoscalerSpec on schedule. The earlier a scheduled override is, the higher it is prioritized.
             */
            scheduledOverrides?: pulumi.Input<pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecScheduledoverridesArgs>[]>;
        }

        /**
         * CapacityReservation specifies the number of replicas temporarily added to the scale target until ExpirationTime.
         */
        export interface HorizontalRunnerAutoscalerSpecCapacityreservationsArgs {
            effectiveTime?: pulumi.Input<string>;
            expirationTime?: pulumi.Input<string>;
            name?: pulumi.Input<string>;
            replicas?: pulumi.Input<number>;
        }

        export interface HorizontalRunnerAutoscalerSpecGithubapicredentialsfromArgs {
            secretRef?: pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecGithubapicredentialsfromSecretrefArgs>;
        }

        export interface HorizontalRunnerAutoscalerSpecGithubapicredentialsfromSecretrefArgs {
            name: pulumi.Input<string>;
        }

        export interface HorizontalRunnerAutoscalerSpecMetricsArgs {
            /**
             * RepositoryNames is the list of repository names to be used for calculating the metric. For example, a repository name is the REPO part of `github.com/USER/REPO`.
             */
            repositoryNames?: pulumi.Input<pulumi.Input<string>[]>;
            /**
             * ScaleDownAdjustment is the number of runners removed on scale-down. You can only specify either ScaleDownFactor or ScaleDownAdjustment.
             */
            scaleDownAdjustment?: pulumi.Input<number>;
            /**
             * ScaleDownFactor is the multiplicative factor applied to the current number of runners used to determine how many pods should be removed.
             */
            scaleDownFactor?: pulumi.Input<string>;
            /**
             * ScaleDownThreshold is the percentage of busy runners less than which will trigger the hpa to scale the runners down.
             */
            scaleDownThreshold?: pulumi.Input<string>;
            /**
             * ScaleUpAdjustment is the number of runners added on scale-up. You can only specify either ScaleUpFactor or ScaleUpAdjustment.
             */
            scaleUpAdjustment?: pulumi.Input<number>;
            /**
             * ScaleUpFactor is the multiplicative factor applied to the current number of runners used to determine how many pods should be added.
             */
            scaleUpFactor?: pulumi.Input<string>;
            /**
             * ScaleUpThreshold is the percentage of busy runners greater than which will trigger the hpa to scale runners up.
             */
            scaleUpThreshold?: pulumi.Input<string>;
            /**
             * Type is the type of metric to be used for autoscaling. It can be TotalNumberOfQueuedAndInProgressWorkflowRuns or PercentageRunnersBusy.
             */
            type?: pulumi.Input<string>;
        }

        /**
         * ScaleTargetRef sis the reference to scaled resource like RunnerDeployment
         */
        export interface HorizontalRunnerAutoscalerSpecScaletargetrefArgs {
            /**
             * Kind is the type of resource being referenced
             */
            kind?: pulumi.Input<string>;
            /**
             * Name is the name of resource being referenced
             */
            name?: pulumi.Input<string>;
        }

        export interface HorizontalRunnerAutoscalerSpecScaleuptriggersArgs {
            amount?: pulumi.Input<number>;
            duration?: pulumi.Input<string>;
            githubEvent?: pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecScaleuptriggersGithubeventArgs>;
        }

        export interface HorizontalRunnerAutoscalerSpecScaleuptriggersGithubeventArgs {
            /**
             * https://docs.github.com/en/actions/reference/events-that-trigger-workflows#check_run
             */
            checkRun?: pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecScaleuptriggersGithubeventCheckrunArgs>;
            /**
             * https://docs.github.com/en/actions/reference/events-that-trigger-workflows#pull_request
             */
            pullRequest?: pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecScaleuptriggersGithubeventPullrequestArgs>;
            /**
             * PushSpec is the condition for triggering scale-up on push event Also see https://docs.github.com/en/actions/reference/events-that-trigger-workflows#push
             */
            push?: pulumi.Input<{[key: string]: any}>;
            /**
             * https://docs.github.com/en/developers/webhooks-and-events/webhooks/webhook-events-and-payloads#workflow_job
             */
            workflowJob?: pulumi.Input<{[key: string]: any}>;
        }

        /**
         * https://docs.github.com/en/actions/reference/events-that-trigger-workflows#check_run
         */
        export interface HorizontalRunnerAutoscalerSpecScaleuptriggersGithubeventCheckrunArgs {
            /**
             * Names is a list of GitHub Actions glob patterns. Any check_run event whose name matches one of patterns in the list can trigger autoscaling. Note that check_run name seem to equal to the job name you've defined in your actions workflow yaml file. So it is very likely that you can utilize this to trigger depending on the job.
             */
            names?: pulumi.Input<pulumi.Input<string>[]>;
            /**
             * Repositories is a list of GitHub repositories. Any check_run event whose repository matches one of repositories in the list can trigger autoscaling.
             */
            repositories?: pulumi.Input<pulumi.Input<string>[]>;
            status?: pulumi.Input<string>;
            /**
             * One of: created, rerequested, or completed
             */
            types?: pulumi.Input<pulumi.Input<string>[]>;
        }

        /**
         * https://docs.github.com/en/actions/reference/events-that-trigger-workflows#pull_request
         */
        export interface HorizontalRunnerAutoscalerSpecScaleuptriggersGithubeventPullrequestArgs {
            branches?: pulumi.Input<pulumi.Input<string>[]>;
            types?: pulumi.Input<pulumi.Input<string>[]>;
        }

        /**
         * ScheduledOverride can be used to override a few fields of HorizontalRunnerAutoscalerSpec on schedule. A schedule can optionally be recurring, so that the corresponding override happens every day, week, month, or year.
         */
        export interface HorizontalRunnerAutoscalerSpecScheduledoverridesArgs {
            /**
             * EndTime is the time at which the first override ends.
             */
            endTime: pulumi.Input<string>;
            /**
             * MinReplicas is the number of runners while overriding. If omitted, it doesn't override minReplicas.
             */
            minReplicas?: pulumi.Input<number>;
            recurrenceRule?: pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerSpecScheduledoverridesRecurrenceruleArgs>;
            /**
             * StartTime is the time at which the first override starts.
             */
            startTime: pulumi.Input<string>;
        }

        export interface HorizontalRunnerAutoscalerSpecScheduledoverridesRecurrenceruleArgs {
            /**
             * Frequency is the name of a predefined interval of each recurrence. The valid values are "Daily", "Weekly", "Monthly", and "Yearly". If empty, the corresponding override happens only once.
             */
            frequency?: pulumi.Input<string>;
            /**
             * UntilTime is the time of the final recurrence. If empty, the schedule recurs forever.
             */
            untilTime?: pulumi.Input<string>;
        }

        export interface HorizontalRunnerAutoscalerStatusArgs {
            cacheEntries?: pulumi.Input<pulumi.Input<inputs.actions.v1alpha1.HorizontalRunnerAutoscalerStatusCacheentriesArgs>[]>;
            /**
             * DesiredReplicas is the total number of desired, non-terminated and latest pods to be set for the primary RunnerSet This doesn't include outdated pods while upgrading the deployment and replacing the runnerset.
             */
            desiredReplicas?: pulumi.Input<number>;
            lastSuccessfulScaleOutTime?: pulumi.Input<string>;
            /**
             * ObservedGeneration is the most recent generation observed for the target. It corresponds to e.g. RunnerDeployment's generation, which is updated on mutation by the API Server.
             */
            observedGeneration?: pulumi.Input<number>;
            /**
             * ScheduledOverridesSummary is the summary of active and upcoming scheduled overrides to be shown in e.g. a column of a `kubectl get hra` output for observability.
             */
            scheduledOverridesSummary?: pulumi.Input<string>;
        }

        export interface HorizontalRunnerAutoscalerStatusCacheentriesArgs {
            expirationTime?: pulumi.Input<string>;
            key?: pulumi.Input<string>;
            value?: pulumi.Input<number>;
        }
    }
}
