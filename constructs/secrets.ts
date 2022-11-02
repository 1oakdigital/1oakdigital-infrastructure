import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as k8s from "@pulumi/kubernetes";
import * as inputs from "@pulumi/kubernetes/types/input";

const stack = pulumi.getStack();
const config = new pulumi.Config();
const tags = {stack};

export interface SSMParameterSecret {
  name: string;
  value: pulumi.Output<string>;
  ssmParameterName: string;
  ssmParameter: aws.ssm.Parameter;
}

export const ssmParameterPrefix = `/recruit-instantly/${stack}`;

export function outputSecret(
  secret: pulumi.Output<string>,
  name: string
): SSMParameterSecret {
  const value = pulumi.secret(secret);
  const ssmParameterName = `${ssmParameterPrefix}/${name}`;
  return {
    name,
    value: pulumi.secret(secret),
    ssmParameterName,
    ssmParameter: new aws.ssm.Parameter(`recruit-instantly-web-${stack}-${name}`, {
      name: ssmParameterName,
      type: "SecureString",
      value,
      tags,
    }),
  };
}

export function configSecretString(
  config: pulumi.Config,
  name: string
): SSMParameterSecret {
  const value = config.requireSecret(name);
  const ssmParameterName = `${ssmParameterPrefix}/${name}`;
  return {
    name,
    value,
    ssmParameterName,
    ssmParameter: new aws.ssm.Parameter(`recruit-instantly-${stack}-${name}`, {
      name: ssmParameterName,
      type: "SecureString",
      value,
      tags,
    }),
  };
}

export function configSecret(name: string, keys?: string[]): aws.secretsmanager.Secret {
  let value
  if (keys) {
    const secrets = {}
    keys.forEach((secretKey:string) => {
      // @ts-ignore
      secrets[secretKey]=config.getSecret(secretKey) || ""
    })
    value = pulumi.all(secrets).apply(secrets => JSON.stringify(secrets))
  } else {
    value = config.getSecret(name) || '';
  }
  const secret = new aws.secretsmanager.Secret(`${stack}-${name}-secret`, {
    name: `${stack}/${name}`,
  });
  new aws.secretsmanager.SecretVersion(`${stack}-${name}-secret-version`, {
    secretId: secret.id,
    secretString: value,
  });
  return secret;
}

export interface ConfigEksSecretProps {
  namespace?: string
  target?: string
  data?: any[],
  keys?: string[]
}

export function configClusterExternalSecret(name: string, props: ConfigEksSecretProps): inputs.core.v1.EnvFromSource {
  const secret = configSecret(name, props.keys)
  // TODO add es2021
  const cleanedName = name.toLowerCase().replace("_", "-").replace("_", "-")
  const data = []
  if (props.keys) {
    props.keys?.forEach(secretKey => {
      data.push({
        secretKey,
        remoteRef: {
          key: secret.name,
          property: secretKey
        }
      })
    })
  } else {
    data.push(
      {
        secretKey: name,
        remoteRef: {
          key: secret.name
        }
      },
    )
  }

  new k8s.apiextensions.CustomResource(name, {
    apiVersion: "external-secrets.io/v1beta1",
    kind: "ExternalSecret",
    metadata: {
      name: cleanedName,
      namespace: props.namespace
    },
    spec: {
      secretStoreRef: {
        name: "secretstore-aws",
        kind: "ClusterSecretStore"
      },
      target: {
        name: props.target || cleanedName,
        creationPolicyOwner: "Owner"
      },
     data
    }
  })
  return {secretRef: {name:cleanedName}}
}
