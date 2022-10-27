import * as k8s from "@pulumi/kubernetes";
import {OutputInstance} from "@pulumi/pulumi";


export class GrafanaK8s {


    constructor(stack: string, clusterName: OutputInstance<string> | string) {
        const name = "grafana-agent"
        const namespace = "default"
        const agent = new k8s.apiextensions.CustomResource(
            name, {
                apiVersion: "monitoring.grafana.com/v1alpha1",
                kind: "GrafanaAgent",
                metadata: {
                    name,
                    namespace,
                    "labels": {
                        "app": name,
                    }
                },
                "spec": {
                    "image": "grafana/agent:v0.28.0",
                    "logLevel": "info",
                    "serviceAccountName": "grafana-agent",
                    "metrics": {
                        "instanceSelector": {
                            "matchLabels": {
                                "agent": "grafana-agent-metrics"
                            }
                        },
                        "externalLabels": {
                            "cluster": clusterName
                        }
                    },
                    "logs": {
                        "instanceSelector": {
                            "matchLabels": {
                                "agent": "grafana-agent-logs"
                            }
                        }
                    }
                }

            },
        )
        const labels = {
            release: "prometheus"
        }
        const sa = new k8s.core.v1.ServiceAccount(`${name}-sa`, {
            metadata: {name, namespace}
        })

        const clusterRole = new k8s.rbac.v1.ClusterRole(`${name}-cluster-role`, {

            "metadata": {
                name
            },
            "rules": [
                {
                    "apiGroups": [
                        ""
                    ],
                    "resources": [
                        "nodes",
                        "nodes/proxy",
                        "nodes/metrics",
                        "services",
                        "endpoints",
                        "pods",
                        "events"
                    ],
                    "verbs": [
                        "get",
                        "list",
                        "watch"
                    ]
                },
                {
                    "apiGroups": [
                        "networking.k8s.io"
                    ],
                    "resources": [
                        "ingresses"
                    ],
                    "verbs": [
                        "get",
                        "list",
                        "watch"
                    ]
                },
                {
                    "nonResourceURLs": [
                        "/metrics",
                        "/metrics/cadvisor"
                    ],
                    "verbs": [
                        "get"
                    ]
                }
            ]

        })

        new k8s.rbac.v1.ClusterRoleBinding(`${name}-cluster-role-binding`, {
            "metadata": {
                name
            },
            "roleRef": {
                "apiGroup": "rbac.authorization.k8s.io",
                "kind": "ClusterRole",
                "name": clusterRole.metadata.name
            },
            "subjects": [
                {
                    "kind": "ServiceAccount",
                    "name": sa.metadata.name,
                    namespace
                }
            ]
        })

        const secret = new k8s.core.v1.Secret(`${name}-secret`, {
            metadata: {
                name: "primary-credentials-metrics",
                namespace
            },
            stringData: {
                username: "622277",
                password: "eyJrIjoiOTNmNDM0ZWUzMTBmOTkzZTk0YjI5MjZmZDU5NGMwN2I1Y2NiNmYyOCIsIm4iOiJkZXYta3ViZXJuZXRlcy1hcGkta2V5IiwiaWQiOjczMTcxOH0=",
            }
        })


        new k8s.apiextensions.CustomResource(`${name}-metrics-instance`, {
            "apiVersion": "monitoring.grafana.com/v1alpha1",
            "kind": "MetricsInstance",
            "metadata": {
                "name": "primary",
                namespace,
                "labels": {
                    "agent": "grafana-agent-metrics"
                }
            },
            "spec": {
                "remoteWrite": [
                    {
                        "url": "https://prometheus-prod-05-gb-south-0.grafana.net/api/prom/push",
                        "basicAuth": {
                            "username": {
                                "name": secret.metadata.name,
                                "key": "username"
                            },
                            "password": {
                                "name": secret.metadata.name,
                                "key": "password"
                            }
                        }
                    }
                ],
                "serviceMonitorNamespaceSelector": {},
                "serviceMonitorSelector": {
                    "matchLabels": labels
                },
                "podMonitorNamespaceSelector": {},
                "podMonitorSelector": {
                    "matchLabels": labels
                },
                "probeNamespaceSelector": {},
                "probeSelector": {
                    "matchLabels": labels
                }
            }
        })
        new k8s.apiextensions.CustomResource(`${name}-kubelet-service-monitor`, {
                "apiVersion": "monitoring.coreos.com/v1",
                "kind": "ServiceMonitor",
                "metadata": {
                    "labels": {
                        "instance": "primary"
                    },
                    "name": "kubelet-monitor",
                    namespace,
                },
                "spec": {
                    "endpoints": [
                        {
                            "bearerTokenFile": "/var/run/secrets/kubernetes.io/serviceaccount/token",
                            "honorLabels": true,
                            "interval": "60s",
                            "metricRelabelings": [
                                {
                                    "action": "keep",
                                    "regex": "kubelet_cgroup_manager_duration_seconds_count|go_goroutines|kubelet_pod_start_duration_seconds_count|kubelet_runtime_operations_total|kubelet_pleg_relist_duration_seconds_bucket|volume_manager_total_volumes|kubelet_volume_stats_capacity_bytes|container_cpu_usage_seconds_total|container_network_transmit_bytes_total|kubelet_runtime_operations_errors_total|container_network_receive_bytes_total|container_memory_swap|container_network_receive_packets_total|container_cpu_cfs_periods_total|container_cpu_cfs_throttled_periods_total|kubelet_running_pod_count|node_namespace_pod_container:container_cpu_usage_seconds_total:sum_rate|container_memory_working_set_bytes|storage_operation_errors_total|kubelet_pleg_relist_duration_seconds_count|kubelet_running_pods|rest_client_request_duration_seconds_bucket|process_resident_memory_bytes|storage_operation_duration_seconds_count|kubelet_running_containers|kubelet_runtime_operations_duration_seconds_bucket|kubelet_node_config_error|kubelet_cgroup_manager_duration_seconds_bucket|kubelet_running_container_count|kubelet_volume_stats_available_bytes|kubelet_volume_stats_inodes|container_memory_rss|kubelet_pod_worker_duration_seconds_count|kubelet_node_name|kubelet_pleg_relist_interval_seconds_bucket|container_network_receive_packets_dropped_total|kubelet_pod_worker_duration_seconds_bucket|container_start_time_seconds|container_network_transmit_packets_dropped_total|process_cpu_seconds_total|storage_operation_duration_seconds_bucket|container_memory_cache|container_network_transmit_packets_total|kubelet_volume_stats_inodes_used|up|rest_client_requests_total",
                                    "sourceLabels": [
                                        "__name__"
                                    ]
                                }
                            ],
                            "port": "https-metrics",
                            "relabelings": [
                                {
                                    "sourceLabels": [
                                        "__metrics_path__"
                                    ],
                                    "targetLabel": "metrics_path"
                                },
                                {
                                    "action": "replace",
                                    "targetLabel": "job",
                                    "replacement": "integrations/kubernetes/kubelet"
                                }
                            ],
                            "scheme": "https",
                            "tlsConfig": {
                                "insecureSkipVerify": true
                            }
                        }
                    ],
                    "namespaceSelector": {
                        "matchNames": [
                            namespace
                        ]
                    },
                    "selector": {
                        "matchLabels": {
                            "app.kubernetes.io/name": "kubelet"
                        }
                    }
                }
            }
        )
        new k8s.apiextensions.CustomResource(`${name}-cadvsior-service-monitor`,
            {
                "apiVersion": "monitoring.coreos.com/v1",
                "kind": "ServiceMonitor",
                "metadata": {
                    labels,
                    "name": "cadvisor-monitor",
                    namespace
                },
                "spec": {
                    "endpoints": [
                        {
                            "bearerTokenFile": "/var/run/secrets/kubernetes.io/serviceaccount/token",
                            "honorLabels": true,
                            "honorTimestamps": false,
                            "interval": "60s",
                            "metricRelabelings": [
                                {
                                    "action": "keep",
                                    "regex": "kubelet_cgroup_manager_duration_seconds_count|go_goroutines|kubelet_pod_start_duration_seconds_count|kubelet_runtime_operations_total|kubelet_pleg_relist_duration_seconds_bucket|volume_manager_total_volumes|kubelet_volume_stats_capacity_bytes|container_cpu_usage_seconds_total|container_network_transmit_bytes_total|kubelet_runtime_operations_errors_total|container_network_receive_bytes_total|container_memory_swap|container_network_receive_packets_total|container_cpu_cfs_periods_total|container_cpu_cfs_throttled_periods_total|kubelet_running_pod_count|node_namespace_pod_container:container_cpu_usage_seconds_total:sum_rate|container_memory_working_set_bytes|storage_operation_errors_total|kubelet_pleg_relist_duration_seconds_count|kubelet_running_pods|rest_client_request_duration_seconds_bucket|process_resident_memory_bytes|storage_operation_duration_seconds_count|kubelet_running_containers|kubelet_runtime_operations_duration_seconds_bucket|kubelet_node_config_error|kubelet_cgroup_manager_duration_seconds_bucket|kubelet_running_container_count|kubelet_volume_stats_available_bytes|kubelet_volume_stats_inodes|container_memory_rss|kubelet_pod_worker_duration_seconds_count|kubelet_node_name|kubelet_pleg_relist_interval_seconds_bucket|container_network_receive_packets_dropped_total|kubelet_pod_worker_duration_seconds_bucket|container_start_time_seconds|container_network_transmit_packets_dropped_total|process_cpu_seconds_total|storage_operation_duration_seconds_bucket|container_memory_cache|container_network_transmit_packets_total|kubelet_volume_stats_inodes_used|up|rest_client_requests_total",
                                    "sourceLabels": [
                                        "__name__"
                                    ]
                                }
                            ],
                            "path": "/metrics/cadvisor",
                            "port": "https-metrics",
                            "relabelings": [
                                {
                                    "sourceLabels": [
                                        "__metrics_path__"
                                    ],
                                    "targetLabel": "metrics_path"
                                },
                                {
                                    "action": "replace",
                                    "targetLabel": "job",
                                    "replacement": "integrations/kubernetes/cadvisor"
                                }
                            ],
                            "scheme": "https",
                            "tlsConfig": {
                                "insecureSkipVerify": true
                            }
                        }
                    ],
                    "namespaceSelector": {
                        "matchNames": [
                            namespace
                        ]
                    },
                    "selector": {
                        "matchLabels": {
                            "app.kubernetes.io/name": "kubelet"
                        }
                    }
                }
            }
        )

        const logsSecret = new k8s.core.v1.Secret(`${name}-logs-secret`, {
            metadata: {
                name: "grafana-loki-push",
                namespace
            },
            stringData: {
                username: "310108",
                password: "eyJrIjoiYjQ2NzkxZjg3MTliMTA3ZDM1MzhhZDA2OWUyMzM4MmE3NTVjMzBkYyIsIm4iOiJzdGFjay00NjA3NTItZWFzeXN0YXJ0LXByb20tcHVibGlzaGVyIiwiaWQiOjczMTcxOH0="
            }
        })
         // TODO Detailed labales
        new k8s.apiextensions.CustomResource(`${name}-logs-instance`, {
            "apiVersion": "monitoring.grafana.com/v1alpha1",
            "kind": "LogsInstance",
            "metadata": {
                "name": "primary",
                namespace,
                "labels": {
                    "agent": "grafana-agent-logs"
                }
            },
            "spec": {
                "clients": [
                    {
                        "url": "https://logs-prod-008.grafana.net/loki/api/v1/push",
                        "basicAuth": {
                            "username": {
                                "name": logsSecret.metadata.name,
                                "key": "username"
                            },
                            "password": {
                                "name": logsSecret.metadata.name,
                                "key": "password"
                            }
                        }
                    }
                ],
                podLogsNamespaceSelector: {},
                podLogsSelector: {"matchLabels": labels}
            }
        })
        // TODO Detailed Logging
        new k8s.apiextensions.CustomResource(`${name}-general-pod-logs`, {
            "apiVersion": "monitoring.grafana.com/v1alpha1",
            "kind": "PodLogs",
            "metadata": {
                "labels": labels,
                "name": "kubernetes-pods",
                "namespace": "default"
            },
            "spec": {
                "pipelineStages": [
                    {
                        "docker": {}
                    }
                ],
                "namespaceSelector": {
                    "matchNames": [
                        "default",
                        "websites",
                        // "automation"
                    ]
                },
                "selector": {
                    // "matchLabels": {}
                }
            }
        })
    }
}
