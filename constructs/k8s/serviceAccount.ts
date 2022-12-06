import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import * as inputs from "@pulumi/aws/types/input";
import { Output } from "@pulumi/pulumi/output";

export interface ServiceAccountProps {
  name: string;
  namespace: string;
  oidcProvider?: aws.iam.OpenIdConnectProvider;
  cluster: eks.Cluster;
  inlinePolicies?: pulumi.Input<pulumi.Input<inputs.iam.RoleInlinePolicy>[]>;
  managedPolicyArns?: string[];
}

export class ServiceAccount {
  readonly name: string;
  readonly roleArn: Output<string>;

  constructor(props: ServiceAccountProps) {
    this.name = props.name;
    const saAssumeRolePolicy = pulumi
      // @ts-ignore
      .all([props.oidcProvider.url, props.oidcProvider.arn])
      .apply(([url, arn]) =>
        aws.iam.getPolicyDocument({
          statements: [
            {
              actions: ["sts:AssumeRoleWithWebIdentity"],
              conditions: [
                {
                  test: "StringEquals",
                  values: [
                    `system:serviceaccount:${props.namespace}:${props.name}`,
                  ],
                  variable: `${url.replace("https://", "")}:sub`,
                },
              ],
              effect: "Allow",
              principals: [{ identifiers: [arn], type: "Federated" }],
            },
          ],
        })
      );

    const role = new aws.iam.Role(props.name, {
      assumeRolePolicy: saAssumeRolePolicy.json,
      inlinePolicies: props.inlinePolicies,
      managedPolicyArns: props.managedPolicyArns,
    });
    this.roleArn = role.arn;

    // Create a Service Account with the IAM role annotated to use with the Pod.
    new k8s.core.v1.ServiceAccount(
      props.name,
      {
        metadata: {
          namespace: props.namespace,
          name: props.name,
          annotations: {
            "eks.amazonaws.com/role-arn": role.arn,
          },
        },
      },
      { provider: props.cluster.provider }
    );
  }
}
