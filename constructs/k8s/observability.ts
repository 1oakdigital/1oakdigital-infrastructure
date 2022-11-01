import * as k8s from "@pulumi/kubernetes";
import * as aws from "@pulumi/aws";
import { Output } from "@pulumi/pulumi/output";

export interface K8sObservabilityProps {
  provider: k8s.Provider;
  namespace: string;
  prometheusReaderSecret?: string | Output<string>;
}

export class K8sObservability {
  constructor(stack: string, props: K8sObservabilityProps) {
    const { namespace,  provider, prometheusReaderSecret } = props;

    new k8s.helm.v3.Release(
      "metrics-server",
      {
        chart: "metrics-server",
        version: "3.8.2",
        name: "metrics-server",
        namespace: "kube-system",
        values: {
          hostNetwork: { enabled: true },
        },
        repositoryOpts: {
          repo: "https://kubernetes-sigs.github.io/metrics-server",
        },
      },
      { provider, deleteBeforeReplace: true }
    );
    new k8s.helm.v3.Release(
      "kube-state-metrics",
      {
        chart: "kube-state-metrics",
        version: "4.21.0",
        values: {
          image: { tag: "v2.6.0" },
          prometheus: {
            monitor: {
              enabled: true,
              honorLabels: true,
              additionalLabels: { release: "prometheus" },
            },
          },
          verticalPodAutoscaler: { enabled: true },
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
        version: "5.10.0",
        name: "kubernetes-dashboard",
        repositoryOpts: {
          repo: "https://kubernetes.github.io/dashboard",
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

    if(prometheusReaderSecret)
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
      }, {dependsOn:[keda]}
    );

  }
}
