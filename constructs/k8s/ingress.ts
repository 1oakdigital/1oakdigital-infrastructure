import * as k8s from "@pulumi/kubernetes";
import { ServiceAccount } from "./serviceAccount";
import { AlbControllerPolicy } from "../policies";
import { region } from "../../index";
import * as pulumi from "@pulumi/pulumi";
import * as eks from "@pulumi/eks";
import * as aws from "@pulumi/aws";
import {controllerAffinity, coreControllerTaint} from "../../configs/consts";

export interface AwsNginxIngressProps {
  provider: k8s.Provider;
  namespace: string;
  clusterName: string;
  domains: string[];
  certificates: any[];
  cluster: eks.Cluster;
  clusterOidcProvider: aws.iam.OpenIdConnectProvider;

}

export class AwsNginxIngress {
  constructor(stack: string, props: AwsNginxIngressProps) {
    const { namespace, provider, clusterOidcProvider, cluster, clusterName} = props;

    const albServiceAccount = new ServiceAccount({
      name: `aws-load-balancer-controller`,
      oidcProvider: clusterOidcProvider,
      cluster: cluster,
      namespace,
      inlinePolicies: [{ name: "alb", policy: AlbControllerPolicy }],
    });
    new k8s.helm.v3.Release("aws-load-balancer-controller", {
      chart: "aws-load-balancer-controller",
      // name: "aws-load-balancer-controller",
      version: "1.4.5",
      namespace,

      values: {
        clusterName,
        env: { AWS_REGION: region },
        serviceAccount: { create: false, name: albServiceAccount.name },
        serviceMonitor: {
          enabled: true,
          additionalLabels: { release: "prometheus" },
          namespace
        },
        cleanupOnFail: true,
        affinity: controllerAffinity,
        tolerations: [coreControllerTaint],
      },
      repositoryOpts: {
        repo: "https://aws.github.io/eks-charts",
      },
    });

    new k8s.helm.v3.Release(
      "ingress-nginx",
      {
        chart: "ingress-nginx",
        version: "4.3.0",
        namespace,
        values: {
          controller: {
            autoscaling: {
              enabled: true,
              minReplicas: 1,
              maxReplicas: 2,
            },
            containerPort: {
              http: 80,
              https: 443,
            },
            service: {
              targetPorts: {
                http: "http",
                https: "80",
              },
              annotations: {
                "external-dns.alpha.kubernetes.io/hostname": props.domains.toString(),
                "service.beta.kubernetes.io/aws-load-balancer-ssl-cert": pulumi
                  .all(props.certificates)
                  .apply((certificates) => certificates.toString()),
                "service.beta.kubernetes.io/aws-load-balancer-backend-protocol":
                  "tcp",
                "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled":
                  "true",
                "service.beta.kubernetes.io/aws-load-balancer-ssl-ports": "443",
                "service.beta.kubernetes.io/aws-load-balancer-type": "external",
                "service.beta.kubernetes.io/aws-load-balancer-scheme":
                  "internet-facing",
                "service.beta.kubernetes.io/aws-load-balancer-connection-idle-timeout":
                  "3600",
                "service.beta.kubernetes.io/aws-load-balancer-nlb-target-type":
                  "instance",
                "service.beta.kubernetes.io/aws-load-balancer-ssl-negotiation-policy":
                  "ELBSecurityPolicy-TLS13-1-2-2021-06",
              },
            },
            metrics: {
              enabled: true,
              serviceMonitor: {
                enabled: true,
                additionalLabels: { release: "prometheus" },
              },
              service: {
                annotations: {
                  "prometheus.io/scrape": "true",
                  "prometheus.io/port": "10254",
                },
              },
            },
            podAnnotations: {
              "prometheus.io/scrape": "true",
              "prometheus.io/port": "10254",
            },
          },
        },
        repositoryOpts: {
          repo: "https://kubernetes.github.io/ingress-nginx",
        },
      },
      { provider, deleteBeforeReplace: true }
    );
  }
}
