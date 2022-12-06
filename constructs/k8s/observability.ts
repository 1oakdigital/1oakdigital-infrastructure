import * as k8s from "@pulumi/kubernetes";
import { Output } from "@pulumi/pulumi/output";
import { controllerAffinity, coreControllerTaint } from "../../configs/consts";

export interface K8sObservabilityProps {
  provider: k8s.Provider;
  namespace: string;
  prometheusReaderSecret?: string | Output<string>;
}

export class K8sObservability {
  constructor(stack: string, props: K8sObservabilityProps) {
    const { namespace, provider, prometheusReaderSecret } = props;

    new k8s.helm.v3.Release(
      "metrics-server",
      {
        chart: "metrics-server",
        version: "3.8.2",
        name: "metrics-server",
        namespace: "kube-system",
        values: {
          metrics: { enabled: true },
          serviceMonitor: {
            enabled: true,
            additionalLabels: { instance: "primary" },
          },
          affinity: controllerAffinity,
          tolerations: [coreControllerTaint],
        },
        repositoryOpts: {
          repo: "https://kubernetes-sigs.github.io/metrics-server",
        },
      },
      { provider, deleteBeforeReplace: true }
    );
    new k8s.helm.v3.Release(
      "opentelemetry-operator",
      {
        chart: "opentelemetry-operator",
        version: "0.18.0",
        name: "opentelemetry-operator",
        namespace: "automation",
        values: {
          admissionWebhooks: { certManager: { enabled: false } },
          tolerations: [coreControllerTaint],
        },
        repositoryOpts: {
          repo: "https://open-telemetry.github.io/opentelemetry-helm-charts",
        },
      },
      { provider, deleteBeforeReplace: true }
    );
    new k8s.helm.v3.Release(
      "kube-state-metrics",
      {
        chart: "kube-state-metrics",
        name: "kube-state-metrics",
        namespace,
        version: "4.24.0",
        values: {
          prometheus: {
            monitor: {
              enabled: true,
              honorLabels: true,
              jobLabel: "integrations/kubernetes/kube-state-metrics",
              additionalLabels: { release: "prometheus" },
              relabelings: [
                {
                  sourceLabels: ["__metrics_path__"],
                  targetLabel: "metrics_path",
                },
                {
                  action: "replace",
                  targetLabel: "job",
                  replacement: "integrations/kubernetes/kube-state-metrics",
                },
              ],
              metricRelabelings: [
                // {
                //   action: "keep",
                //   regex:
                //     "cluster:namespace:pod_memory:active:kube_pod_container_resource_limits|cluster:namespace:pod_cpu:active:kube_pod_container_resource_limits|kube_statefulset_status_replicas_ready|kube_deployment_spec_replicas|container_cpu_cfs_periods_total|container_network_receive_bytes_total|cluster:namespace:pod_cpu:active:kube_pod_container_resource_requests|node_namespace_pod_container:container_memory_rss|container_network_transmit_packets_total|namespace_memory:kube_pod_container_resource_requests:sum|kubernetes_build_info|kube_statefulset_status_replicas|kube_deployment_status_observed_generation|kube_daemonset_status_desired_number_scheduled|container_network_receive_packets_dropped_total|kubelet_volume_stats_available_bytes|kube_pod_owner|container_network_receive_packets_total|kube_node_status_allocatable|go_goroutines|kube_statefulset_status_replicas_updated|machine_memory_bytes|kube_horizontalpodautoscaler_status_desired_replicas|kube_pod_status_phase|kube_replicaset_owner|node_namespace_pod_container:container_memory_swap|namespace_workload_pod:kube_pod_owner:relabel|process_resident_memory_bytes|kubelet_node_name|kube_daemonset_status_number_available|kube_statefulset_metadata_generation|kubelet_running_pod_count|storage_operation_errors_total|kube_pod_container_status_waiting_reason|kubelet_node_config_error|kubelet_pod_start_duration_seconds_count|container_memory_working_set_bytes|kubelet_pleg_relist_duration_seconds_count|kubelet_pod_start_duration_seconds_bucket|kube_daemonset_status_current_number_scheduled|container_cpu_usage_seconds_total|kube_pod_info|container_fs_reads_total|kubelet_pleg_relist_interval_seconds_bucket|kube_deployment_metadata_generation|kube_job_failed|namespace_cpu:kube_pod_container_resource_requests:sum|namespace_cpu:kube_pod_container_resource_limits:sum|rest_client_requests_total|kubelet_pod_worker_duration_seconds_bucket|cluster:namespace:pod_memory:active:kube_pod_container_resource_requests|kubelet_pleg_relist_duration_seconds_bucket|kube_daemonset_status_number_misscheduled|kube_deployment_status_replicas_updated|kubelet_certificate_manager_client_ttl_seconds|kube_node_info|kube_pod_container_resource_requests|container_memory_cache|kubelet_running_containers|kube_statefulset_status_update_revision|kubelet_server_expiration_renew_errors|kube_node_status_capacity|kubelet_volume_stats_capacity_bytes|volume_manager_total_volumes|kube_daemonset_status_updated_number_scheduled|kubelet_certificate_manager_client_expiration_renew_errors|node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate|container_fs_writes_bytes_total|process_cpu_seconds_total|kube_namespace_status_phase|kubelet_pod_worker_duration_seconds_count|node_quantile:kubelet_pleg_relist_duration_seconds:histogram_quantile|kubelet_cgroup_manager_duration_seconds_count|kube_horizontalpodautoscaler_spec_max_replicas|container_memory_swap|kubelet_runtime_operations_total|storage_operation_duration_seconds_count|kube_node_status_condition|kube_job_status_active|kubelet_certificate_manager_server_ttl_seconds|kube_pod_container_resource_limits|container_memory_rss|kubelet_volume_stats_inodes|kube_statefulset_status_observed_generation|container_network_transmit_bytes_total|container_network_transmit_packets_dropped_total|kube_statefulset_replicas|kube_statefulset_status_current_revision|container_fs_writes_total|namespace_workload_pod|kubelet_running_container_count|namespace_memory:kube_pod_container_resource_limits:sum|kube_deployment_status_replicas_available|kube_horizontalpodautoscaler_status_current_replicas|container_fs_reads_bytes_total|kubelet_volume_stats_inodes_used|kubelet_running_pods|kubelet_cgroup_manager_duration_seconds_bucket|kube_horizontalpodautoscaler_spec_min_replicas|kube_node_spec_taint|node_namespace_pod_container:container_memory_working_set_bytes|node_namespace_pod_container:container_memory_cache|container_cpu_cfs_throttled_periods_total|kube_resourcequota|kube_job_status_start_time|kubelet_runtime_operations_errors_total|kube_namespace_status_phase|container_cpu_usage_seconds_total|kube_pod_status_phase|kube_pod_start_time|kube_pod_container_status_restarts_total|kube_pod_container_info|kube_pod_container_status_waiting_reason|kube_daemonset.*|kube_replicaset.*|kube_statefulset.*|kube_job.*|kube_node.*|node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate|cluster:namespace:pod_cpu:active:kube_pod_container_resource_requests|namespace_cpu:kube_pod_container_resource_requests:sum",
                //   sourceLabels: ["__name__"],
                // },
                {
                  action: "replace",
                  targetLabel: "job",
                  replacement: "integrations/kubernetes/kube-state-metrics",
                },
              ],
            },
          },
          verticalPodAutoscaler: { enabled: true },
          affinity: controllerAffinity,
          tolerations: [coreControllerTaint],
          selfMonitor: { enabled: true },
          service: { type: "NodePort" },
        },
        repositoryOpts: {
          repo: "https://prometheus-community.github.io/helm-charts",
        },
      },
      { provider, deleteBeforeReplace: true }
    );

    new k8s.helm.v3.Release(
      "kubernetes-dashboard",
      {
        chart: "kubernetes-dashboard",
        version: "6.0.0",
        name: "kubernetes-dashboard",
        repositoryOpts: {
          repo: "https://kubernetes.github.io/dashboard",
        },
        values: {
          replicaCount: 2,
          metricsScraper: { enabled: true },
          // affinity: controllerAffinity,
          tolerations: [coreControllerTaint],
        },
      },
      { provider, deleteBeforeReplace: true }
    );
    //  Keda
    const keda = new k8s.helm.v3.Release("keda", {
      chart: "keda",
      version: "2.8.2",
      name: "keda",
      namespace,
      values: {
        metricsServer: {
          enabled: true,
        },
        // affinity: controllerAffinity,
        // tolerations: [coreControllerTaint],
        prometheus: {
          metricServer: {
            enabled: true,
            useHostNetwork: false,
            podMonitor: {
              enabled: true,
              additionalLabels: { release: "prometheus" },
              namespace,
            },
          },
        },
      },
      repositoryOpts: {
        repo: "https://kedacore.github.io/charts",
      },
    });

    if (prometheusReaderSecret)
      new k8s.apiextensions.CustomResource(
        "keda-prometheus-trigger-auth",
        {
          apiVersion: "keda.sh/v1alpha1",
          kind: "ClusterTriggerAuthentication",
          metadata: {
            name: "keda-prometheus",
            // labels
          },
          spec: {
            secretTargetRef: [
              {
                parameter: "username",
                name: prometheusReaderSecret,
                key: "username",
              },
              {
                parameter: "password",
                name: prometheusReaderSecret,
                key: "password",
              },
            ],
          },
        },
        { dependsOn: [keda] }
      );
  }
}
