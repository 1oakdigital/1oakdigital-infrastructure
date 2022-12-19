import { ServiceAccount } from "./serviceAccount";
import * as k8s from "@pulumi/kubernetes";
import { region } from "../../index";
import * as eks from "@pulumi/eks";
import { ExternalSecretsControllerPolicy } from "../policies";
import * as aws from "@pulumi/aws";
import { Output } from "@pulumi/pulumi/output";

export interface ExternalSecretsProps {
  cluster: eks.Cluster;
  provider: k8s.Provider;
  clusterOidcProvider: aws.iam.OpenIdConnectProvider;
}

export class ExternalSecrets {
  readonly secretStore: k8s.apiextensions.CustomResource;

  constructor(
    stack: string,
    props: ExternalSecretsProps,
    tags?: { [key: string]: string }
  ) {
    const { provider, cluster, clusterOidcProvider } = props;
    const namespace = "external-secrets";
    new k8s.core.v1.Namespace(
      namespace,
      { metadata: { name: "external-secrets" } },
      { provider, deleteBeforeReplace: true }
    );

    const externalSecretsServiceAccount = new ServiceAccount({
      name: `${stack}-external-secrets-controller`,
      oidcProvider: clusterOidcProvider,
      cluster: props.cluster,
      namespace,
      inlinePolicies: [
        { name: "external-secrets", policy: ExternalSecretsControllerPolicy },
      ],
    });

    new k8s.rbac.v1.Role(stack, {
      metadata: {
        namespace,
        name: "external-secrets-role",
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: ["get", "list", "watch"],
        },
        {
          apiGroups: ["authorization.k8s.io"],
          resources: ["selfsubjectrulesreviews"],
          verbs: ["create"],
        },
      ],
    });
    new k8s.rbac.v1.RoleBinding(stack, {
      metadata: {
        namespace,
        name: "external-secrets-role-binding",
      },
      roleRef: {
        kind: "Role",
        name: externalSecretsServiceAccount.name,
        apiGroup: "rbac.authorization.k8s.io",
      },
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
    new k8s.apiextensions.CustomResource(
      "external-secrets-kubernetes-secret-store",
      {
        apiVersion: "external-secrets.io/v1beta1",
        kind: "ClusterSecretStore",
        metadata: {
          name: "secretstore-kubernetes",
          namespace: "external-secrets",
        },
        spec: {
          provider: {
            kubernetes: {
              remoteNamespace: "default",
              server: {
                // url: "https://myapiserver.tld",
                caProvider: {
                  type: "ConfigMap",
                  name: "kube-root-ca.crt",
                  key: "ca.crt",
                  namespace,
                },
              },
              auth: {
                serviceAccount: {
                  name: externalSecretsServiceAccount.name,
                  namespace,
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

export interface DatabaseExternalSecretProps {
  name: string;
  namespace: string;
  secretsManagerSecretName: string | Output<string>;
  secretStore: k8s.apiextensions.CustomResource;
}

export class DatabaseExternalSecret {
  constructor(stack: string, props: DatabaseExternalSecretProps) {
    const { name, namespace, secretsManagerSecretName, secretStore } = props;
    new k8s.apiextensions.CustomResource(
      name,
      {
        apiVersion: "external-secrets.io/v1beta1",
        kind: "ClusterExternalSecret",
        metadata: {
          name,
          namespace: "external-secrets",
        },
        spec: {
          namespaceSelector: {
            matchLabels: { "kubernetes.io/metadata.name": namespace },
          },
          externalSecretName: name,
          externalSecretSpec: {
            refreshInterval: "1h",
            secretStoreRef: {
              name: "secretstore-aws",
              kind: "ClusterSecretStore",
            },
            target: {
              name: name,
              creationPolicyOwner: "Owner",
            },
            data: [
              {
                secretKey: "DB_PASSWORD",
                remoteRef: {
                  key: secretsManagerSecretName,
                  property: "password",
                },
              },
              {
                secretKey: "DB_HOST",
                remoteRef: {
                  key: secretsManagerSecretName,
                  property: "host",
                },
              },
              {
                secretKey: "DB_USERNAME",
                remoteRef: {
                  key: secretsManagerSecretName,
                  property: "username",
                },
              },
              {
                secretKey: "DB_PORT",
                remoteRef: {
                  key: secretsManagerSecretName,
                  property: "port",
                },
              },
              // {
              //   secretKey: "DB_NAME",
              //   remoteRef: {
              //     key: secretsManagerSecretName,
              //     property: "name",
              //   },
              // },
            ],
          },
        },
      },
      { dependsOn: secretStore }
    );
  }
}

export class DatabaseKubernetesExternalSecret {
  constructor(stack: string, props: DatabaseExternalSecretProps) {
    const { name, namespace, secretsManagerSecretName, secretStore } = props;
    new k8s.apiextensions.CustomResource(
      name,
      {
        apiVersion: "external-secrets.io/v1beta1",
        kind: "ClusterExternalSecret",
        metadata: {
          name,
          namespace: "external-secrets",
        },
        spec: {
          namespaceSelector: {
            matchLabels: { "kubernetes.io/metadata.name": namespace },
          },
          externalSecretName: name,
          externalSecretSpec: {
            secretStoreRef: {
              name: "secretstore-kubernetes",
              kind: "ClusterSecretStore",
            },
            target: {
              name: "database",
              creationPolicyOwner: "Owner",
            },
            data: [
              {
                secretKey: "DB_PASSWORD",
                remoteRef: {
                  key: secretsManagerSecretName,
                  property: "password",
                },
              },
              {
                secretKey: "DB_HOST",
                remoteRef: {
                  key: secretsManagerSecretName,
                  property: "host",
                },
              },
              {
                secretKey: "DB_USERNAME",
                remoteRef: {
                  key: secretsManagerSecretName,
                  property: "username",
                },
              },
              {
                secretKey: "DB_PORT",
                remoteRef: {
                  key: secretsManagerSecretName,
                  property: "port",
                },
              },
              {
                secretKey: "DB_NAME",
                remoteRef: {
                  key: secretsManagerSecretName,
                  property: "name",
                },
              },
            ],
          },
        },
      },
      { dependsOn: secretStore }
    );
  }
}
