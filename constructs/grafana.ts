import * as k8s from "@pulumi/kubernetes";
import { OutputInstance, Config } from "@pulumi/pulumi";
import { GrafanaAgent } from "../crds/grafana/agent/monitoring/v1alpha1/grafanaAgent";
import { MetricsInstance } from "../crds/grafana/metricsInstance/monitoring/v1alpha1/metricsInstance";
import { ServiceMonitor } from "../crds/grafana/serviceMonitors/monitoring/v1/serviceMonitor";
import { LogsInstance } from "../crds/grafana/logsInstance/monitoring/v1alpha1/logsInstance";
import { Integration } from "../crds/grafana/integrations/monitoring/v1alpha1/integration";
import { PersistentVolumeClaim } from "@pulumi/kubernetes/core/v1";
import { PodLogs } from "../crds/grafana/podLogs/monitoring/v1alpha1/podLogs";

export class GrafanaK8s {
  constructor(
    stack: string,
    clusterName: OutputInstance<string> | string,
    prometheusUrl: string,
    lokiUrl: string,
    username: OutputInstance<string> | string
  ) {
    const name = "grafana-agent";
    const namespace = "automation";
    const config = new Config();

    const prometheusPushedSecret = new k8s.core.v1.Secret(
      "prometheus-pusher-secret",
      {
        metadata: {
          name: "prometheus-pusher",
          namespace,
        },
        stringData: {
          username,
          password: config.requireSecret("prometheus_pusher_key"),
        },
      }
    );
    const sa = new k8s.core.v1.ServiceAccount(`${name}-sa`, {
      metadata: { name, namespace },
    });
    new GrafanaAgent(name, {
      metadata: {
        name,
        namespace,
        labels: {
          app: name,
        },
      },
      spec: {
        image: "grafana/agent:v0.28.0",
        serviceAccountName: sa.metadata.name,
        metrics: {
          instanceSelector: {
            matchLabels: {
              agent: "grafana-agent",
            },
          },
          externalLabels: {
            cluster: clusterName,
          },
        },
        integrations: {
          selector: { matchLabels: { agent: "grafana-agent" } },
        },
        logs: {
          instanceSelector: {
            matchLabels: {
              agent: "grafana-agent",
            },
          },
        },
      },
    });
    const labels = {
      release: "prometheus",
    };

    const clusterRole = new k8s.rbac.v1.ClusterRole(`${name}-cluster-role`, {
      metadata: {
        name,
      },
      rules: [
        {
          apiGroups: [""],
          resources: [
            "nodes",
            "nodes/proxy",
            "nodes/metrics",
            "services",
            "endpoints",
            "pods",
            "events",
          ],
          verbs: ["get", "list", "watch"],
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingresses"],
          verbs: ["get", "list", "watch"],
        },
        {
          nonResourceURLs: ["/metrics", "/metrics/cadvisor"],
          verbs: ["get"],
        },
      ],
    });
    new k8s.rbac.v1.ClusterRoleBinding(`${name}-cluster-role-binding`, {
      metadata: {
        name,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: clusterRole.metadata.name,
      },
      subjects: [
        {
          kind: "ServiceAccount",
          name: sa.metadata.name,
          namespace,
        },
      ],
    });

    new Integration(`${name}-integration`, {
      metadata: {
        name: "agent-eventhandler",
        namespace,
        labels,
      },
      spec: {
        name: "eventhandler",
        config: {
          cache_path: "/etc/eventhandler/eventhandler.cache",
          logs_instance: "automation/grafana-agent-logs",
        },
        type: { unique: true },
      },
    });

    new MetricsInstance(`${name}-metrics-instance`, {
      metadata: {
        name: "primary",
        namespace,
        labels: {
          agent: "grafana-agent",
        },
      },
      spec: {
        remoteWrite: [
          {
            url: `${prometheusUrl}/push`,
            basicAuth: {
              username: {
                name: prometheusPushedSecret.metadata.name,
                key: "username",
              },
              password: {
                name: prometheusPushedSecret.metadata.name,
                key: "password",
              },
            },
          },
        ],
        serviceMonitorNamespaceSelector: {},
        serviceMonitorSelector: {
          matchLabels: labels,
        },
        podMonitorNamespaceSelector: {},
        podMonitorSelector: {
          matchLabels: labels,
        },
        probeNamespaceSelector: {},
        probeSelector: {
          matchLabels: labels,
        },
      },
    });

    new ServiceMonitor(`${name}-kubelet-service-monitor`, {
      metadata: {
        labels,
        name: "kubelet-monitor",
        namespace: "default",
      },
      spec: {
        endpoints: [
          {
            bearerTokenFile:
              "/var/run/secrets/kubernetes.io/serviceaccount/token",
            honorLabels: true,
            interval: "60s",
            metricRelabelings: [
              {
                action: "keep",
                regex:
                  "kubelet_cgroup_manager_duration_seconds_count|go_goroutines|kubelet_pod_start_duration_seconds_count|kubelet_runtime_operations_total|kubelet_pleg_relist_duration_seconds_bucket|volume_manager_total_volumes|kubelet_volume_stats_capacity_bytes|container_cpu_usage_seconds_total|container_network_transmit_bytes_total|kubelet_runtime_operations_errors_total|container_network_receive_bytes_total|container_memory_swap|container_network_receive_packets_total|container_cpu_cfs_periods_total|container_cpu_cfs_throttled_periods_total|kubelet_running_pod_count|node_namespace_pod_container:container_cpu_usage_seconds_total:sum_rate|container_memory_working_set_bytes|storage_operation_errors_total|kubelet_pleg_relist_duration_seconds_count|kubelet_running_pods|rest_client_request_duration_seconds_bucket|process_resident_memory_bytes|storage_operation_duration_seconds_count|kubelet_running_containers|kubelet_runtime_operations_duration_seconds_bucket|kubelet_node_config_error|kubelet_cgroup_manager_duration_seconds_bucket|kubelet_running_container_count|kubelet_volume_stats_available_bytes|kubelet_volume_stats_inodes|container_memory_rss|kubelet_pod_worker_duration_seconds_count|kubelet_node_name|kubelet_pleg_relist_interval_seconds_bucket|container_network_receive_packets_dropped_total|kubelet_pod_worker_duration_seconds_bucket|container_start_time_seconds|container_network_transmit_packets_dropped_total|process_cpu_seconds_total|storage_operation_duration_seconds_bucket|container_memory_cache|container_network_transmit_packets_total|kubelet_volume_stats_inodes_used|up|rest_client_requests_total",
                sourceLabels: ["__name__"],
              },
            ],
            port: "https-metrics",
            relabelings: [
              {
                sourceLabels: ["__metrics_path__"],
                targetLabel: "metrics_path",
              },
              {
                action: "replace",
                replacement: "integrations/kubernetes/kubelet",
                targetLabel: "job",
              },
            ],
            scheme: "https",
            tlsConfig: {
              insecureSkipVerify: true,
            },
          },
        ],
        namespaceSelector: {
          matchNames: ["default"],
        },
        selector: {
          matchLabels: {
            "app.kubernetes.io/name": "kubelet",
          },
        },
      },
    });
    new ServiceMonitor(`${name}-cadvsior-service-monitor`, {
      metadata: {
        labels,
        name: "cadvisor-monitor",
        namespace: "default",
      },
      spec: {
        endpoints: [
          {
            bearerTokenFile:
              "/var/run/secrets/kubernetes.io/serviceaccount/token",
            honorLabels: true,
            interval: "60s",
            metricRelabelings: [
              {
                action: "keep",
                regex:
                  "cluster:namespace:pod_memory:active:kube_pod_container_resource_limits|cluster:namespace:pod_cpu:active:kube_pod_container_resource_limits|kube_statefulset_status_replicas_ready|kube_deployment_spec_replicas|container_cpu_cfs_periods_total|container_network_receive_bytes_total|cluster:namespace:pod_cpu:active:kube_pod_container_resource_requests|node_namespace_pod_container:container_memory_rss|container_network_transmit_packets_total|namespace_memory:kube_pod_container_resource_requests:sum|kubernetes_build_info|kube_statefulset_status_replicas|kube_deployment_status_observed_generation|kube_daemonset_status_desired_number_scheduled|container_network_receive_packets_dropped_total|kubelet_volume_stats_available_bytes|kube_pod_owner|container_network_receive_packets_total|kube_node_status_allocatable|go_goroutines|kube_statefulset_status_replicas_updated|machine_memory_bytes|kube_horizontalpodautoscaler_status_desired_replicas|kube_pod_status_phase|kube_replicaset_owner|node_namespace_pod_container:container_memory_swap|namespace_workload_pod:kube_pod_owner:relabel|process_resident_memory_bytes|kubelet_node_name|kube_daemonset_status_number_available|kube_statefulset_metadata_generation|kubelet_running_pod_count|storage_operation_errors_total|kube_pod_container_status_waiting_reason|kubelet_node_config_error|kubelet_pod_start_duration_seconds_count|container_memory_working_set_bytes|kubelet_pleg_relist_duration_seconds_count|kubelet_pod_start_duration_seconds_bucket|kube_daemonset_status_current_number_scheduled|container_cpu_usage_seconds_total|kube_pod_info|container_fs_reads_total|kubelet_pleg_relist_interval_seconds_bucket|kube_deployment_metadata_generation|kube_job_failed|namespace_cpu:kube_pod_container_resource_requests:sum|namespace_cpu:kube_pod_container_resource_limits:sum|rest_client_requests_total|kubelet_pod_worker_duration_seconds_bucket|cluster:namespace:pod_memory:active:kube_pod_container_resource_requests|kubelet_pleg_relist_duration_seconds_bucket|kube_daemonset_status_number_misscheduled|kube_deployment_status_replicas_updated|kubelet_certificate_manager_client_ttl_seconds|kube_node_info|kube_pod_container_resource_requests|container_memory_cache|kubelet_running_containers|kube_statefulset_status_update_revision|kubelet_server_expiration_renew_errors|kube_node_status_capacity|kubelet_volume_stats_capacity_bytes|volume_manager_total_volumes|kube_daemonset_status_updated_number_scheduled|kubelet_certificate_manager_client_expiration_renew_errors|node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate|container_fs_writes_bytes_total|process_cpu_seconds_total|kube_namespace_status_phase|kubelet_pod_worker_duration_seconds_count|node_quantile:kubelet_pleg_relist_duration_seconds:histogram_quantile|kubelet_cgroup_manager_duration_seconds_count|kube_horizontalpodautoscaler_spec_max_replicas|container_memory_swap|kubelet_runtime_operations_total|storage_operation_duration_seconds_count|kube_node_status_condition|kube_job_status_active|kubelet_certificate_manager_server_ttl_seconds|kube_pod_container_resource_limits|container_memory_rss|kubelet_volume_stats_inodes|kube_statefulset_status_observed_generation|container_network_transmit_bytes_total|container_network_transmit_packets_dropped_total|kube_statefulset_replicas|kube_statefulset_status_current_revision|container_fs_writes_total|namespace_workload_pod|kubelet_running_container_count|namespace_memory:kube_pod_container_resource_limits:sum|kube_deployment_status_replicas_available|kube_horizontalpodautoscaler_status_current_replicas|container_fs_reads_bytes_total|kubelet_volume_stats_inodes_used|kubelet_running_pods|kubelet_cgroup_manager_duration_seconds_bucket|kube_horizontalpodautoscaler_spec_min_replicas|kube_node_spec_taint|node_namespace_pod_container:container_memory_working_set_bytes|node_namespace_pod_container:container_memory_cache|container_cpu_cfs_throttled_periods_total|kube_resourcequota|kube_job_status_start_time|kubelet_runtime_operations_errors_total|kube_namespace_status_phase|container_cpu_usage_seconds_total|kube_pod_status_phase|kube_pod_start_time|kube_pod_container_status_restarts_total|kube_pod_container_info|kube_pod_container_status_waiting_reason|kube_daemonset.*|kube_replicaset.*|kube_statefulset.*|kube_job.*|kube_node.*|node_namespace_pod_container:container_cpu_usage_seconds_total:sum_irate|cluster:namespace:pod_cpu:active:kube_pod_container_resource_requests|namespace_cpu:kube_pod_container_resource_requests:sum",
                sourceLabels: ["__name__"],
              },
              {
                action: "replace",
                targetLabel: "job",
                replacement: "integrations/kubernetes/cadvisor",
              },
            ],
            path: "/metrics/cadvisor",
            port: "https-metrics",
            relabelings: [
              {
                sourceLabels: ["__metrics_path__"],
                targetLabel: "metrics_path",
              },
              {
                action: "replace",
                targetLabel: "job",
                replacement: "integrations/kubernetes/cadvisor",
              },
            ],
            scheme: "https",
            tlsConfig: {
              insecureSkipVerify: true,
            },
          },
        ],
        selector: {
          matchLabels: {
            "app.kubernetes.io/name": "kubelet",
          },
        },
      },
    });

    const logsSecret = new k8s.core.v1.Secret("loki-logs-pusher-secret", {
      metadata: {
        name: "grafana-loki-push",
        namespace,
      },
      stringData: {
        username: config.requireSecret("loki_username"),
        password: config.requireSecret("loki_password"),
      },
    });

    new LogsInstance(`${name}-logs-instance`, {
      metadata: {
        name: "primary",
        namespace,
        labels: {
          agent: "grafana-agent",
        },
      },
      spec: {
        clients: [
          {
            url: `${lokiUrl}/push`,
            externalLabels: { cluster: clusterName },
            basicAuth: {
              username: {
                name: logsSecret.metadata.name,
                key: "username",
              },
              password: {
                name: logsSecret.metadata.name,
                key: "password",
              },
            },
          },
        ],
        podLogsNamespaceSelector: {},
        podLogsSelector: { matchLabels: labels },
      },
    });
    new PodLogs(`${name}-general-pod-logs`, {
      metadata: {
        labels,
        name: "kubernetes-pods",
        namespace,
      },
      spec: {
        namespaceSelector: {
          any: true,
        },
        pipelineStages: [
          {
            cri: {},
          },
        ],
        relabelings: [
          {
            sourceLabels: ["__meta_kubernetes_pod_node_name"],
            targetLabel: "__host__",
          },
          {
            action: "labelmap",
            regex: "__meta_kubernetes_pod_label_(.+)",
          },
          {
            action: "replace",
            sourceLabels: ["__meta_kubernetes_namespace"],
            targetLabel: "namespace",
          },
          {
            action: "replace",
            sourceLabels: ["__meta_kubernetes_pod_name"],
            targetLabel: "pod",
          },
          {
            action: "replace",
            sourceLabels: ["__meta_kubernetes_container_name"],
            targetLabel: "container",
          },
          {
            replacement: "/var/log/pods/*$1/*.log",
            separator: "/",
            sourceLabels: [
              "__meta_kubernetes_pod_uid",
              "__meta_kubernetes_pod_container_name",
            ],
            targetLabel: "__path__",
          },
        ],
        selector: {
          matchLabels: {},
        },
      },
    });
  }
}
