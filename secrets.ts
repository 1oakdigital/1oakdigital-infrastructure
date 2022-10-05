import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const stack = pulumi.getStack();
const config = new pulumi.Config();
const tags = { stack };

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

export function configSecret(name: string): aws.secretsmanager.Secret {
  const value = config.requireSecret(name);
  const secret = new aws.secretsmanager.Secret(`${stack}-${name}-secret`, {
    name: `${stack}/${name}`,
  });
  new aws.secretsmanager.SecretVersion(`${stack}-${name}-secret-version`, {
    secretId: secret.id,
    secretString: value,
  });
  return secret;
}
