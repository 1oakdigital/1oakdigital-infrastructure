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
        affinity: controllerAffinity,
        tolerations: [coreControllerTaint],
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
