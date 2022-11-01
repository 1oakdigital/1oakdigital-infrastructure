import * as awsx from "@pulumi/awsx";
import { ServiceAccount } from "./serviceAccount";
import * as k8s from "@pulumi/kubernetes";
import { region } from "../../index";
import * as eks from "@pulumi/eks";
import {ExternalSecretsControllerPolicy} from "../policies";
import * as aws from "@pulumi/aws";

export interface ExternalSecretsProps {
  cluster: eks.Cluster;
  provider:k8s.Provider
  clusterOidcProvider:aws.iam.OpenIdConnectProvider
}

export class ExternalSecrets {
  readonly secretStore: k8s.apiextensions.CustomResource
  constructor(
    stack: string,
    props: ExternalSecretsProps,
    tags?: { [key: string]: string }
  ) {
    const { provider, cluster,clusterOidcProvider } = props;
    new k8s.core.v1.Namespace(
      "external-secrets",
      { metadata: { name: "external-secrets" } },
      { provider, deleteBeforeReplace: true }
    );

    const externalSecretsServiceAccount = new ServiceAccount({
      name: `${stack}-external-secrets-controller`,
      oidcProvider:clusterOidcProvider,
      cluster: props.cluster,
      namespace: "external-secrets",
      inlinePolicies: [
        { name: "external-secrets", policy: ExternalSecretsControllerPolicy },
      ],
    });
    const externalSecrets = new k8s.helm.v3.Release(
      "external-secrets",
      {
        chart: "external-secrets",
        version: "0.5.9",
        namespace: "external-secrets",
        values: {
          env: { AWS_REGION: region },
          serviceAccount: {
            create: false,
            name: externalSecretsServiceAccount.name,
          },
        },
        repositoryOpts: {
          repo: "https://charts.external-secrets.io",
        },
      },
      { provider, deleteBeforeReplace: true }
    );
    this.secretStore = new k8s.apiextensions.CustomResource(
      "external-secrets-secret-store",
      {
        apiVersion: "external-secrets.io/v1beta1",
        kind: "ClusterSecretStore",
        metadata: {
          name: "secretstore-aws",
          namespace: "external-secrets",
        },
        spec: {
          provider: {
            aws: {
              service: "SecretsManager",
              region,
              auth: {
                jwt: {
                  serviceAccountRef: {
                    name: externalSecretsServiceAccount.name,
                    namespace: "external-secrets",
                  },
                },
              },
            },
          },
        },
      },
      { dependsOn: externalSecrets, provider, deleteBeforeReplace: true }
    );
  }
}
