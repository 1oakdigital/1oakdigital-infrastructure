import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import { Config } from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { Output } from "@pulumi/pulumi/output";
import { controllerAffinity, coreControllerTaint } from "../../configs/consts";

export interface FlaggerProps {
  provider: k8s.Provider;
  clusterOidcProvider: aws.iam.OpenIdConnectProvider;
  namespace: string;
  prometheusUrl?: string;
  prometheusReaderSecret?: string | Output<string>;
  clusterName: string;
}

export class Flagger {
  constructor(stack: string, props: FlaggerProps) {
    const { namespace, prometheusUrl, clusterName, provider } = props;
    const config = new Config();
    new k8s.helm.v3.Release(
      "flagger",
      {
        chart: "flagger",
        version: "1.25.0",
        namespace,
        values: {
          affinity: controllerAffinity,
          tolerations: [coreControllerTaint],
          logLevel: "debug",
          meshProvider: "nginx",
          // Secrets config disabled, due problems with ExternalSecrets not updating primary secrets
          configTracking: { enabled: true },
          podMonitor: {
            enabled: true,
            additionalLabels: {
              release: "prometheus",
            },
          },
          slack: {
            enabled: true,
            channel: `${stack}-website-deployments`,
            user: "flagger",
            clusterName,
            url: config.requireSecret("flagger-slack-webhook"),
          },
        },
        repositoryOpts: {
          repo: "https://flagger.app",
        },
      },
      { provider, deleteBeforeReplace: true }
    );

    new k8s.helm.v3.Release("flagger-loadtester", {
      chart: "loadtester",
      version: "0.26.0",
      name: "flagger-loadtester",
      namespace,
      values: {
        affinity: controllerAffinity,
        tolerations: [coreControllerTaint],
      },
      repositoryOpts: {
        repo: "https://flagger.app",
      },
    });
    if (prometheusUrl) {
      const successfulRequests = `sum(rate(nginx_ingress_controller_requests{cluster="${clusterName}",ingress="{{ target }}",status!~"[4-5].*",canary=~".*canary.*"}[2m]))`;
      const allRequests = `sum(rate(nginx_ingress_controller_requests{cluster="${clusterName}",ingress="{{ target }}",canary=~".*canary.*"}[2m]))`;
      new k8s.apiextensions.CustomResource("flagger-metric-template-requests", {
        apiVersion: "flagger.app/v1beta1",
        kind: "MetricTemplate",
        metadata: {
          name: "requests",
          namespace,
        },
        spec: {
          provider: {
            type: "prometheus",
            address: prometheusUrl,
            secretRef: {
              name: props.prometheusReaderSecret,
            },
          },
          query: pulumi.interpolate`${allRequests} / ${successfulRequests}`,
        },
      });
    }
  }
}
