import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { CoreStack } from "./stack";

const stack = pulumi.getStack();
export const region = aws.config.requireRegion();
export const RELEASE = process.env.RELEASE ?? "latest";

const currentAccount = aws.getCallerIdentity({});
export const accountId = currentAccount.then((account) => account.accountId);

// @ts-ignore
let stackResources: CoreStack = {};

if (stack == "dev") {
  stackResources = new CoreStack(stack, {
    zoneName: "api.recruitinstantly.com",
    zoneId: "Z01312652ZZTOLESNGTMH",
    cidrBlock: "10.0.0.0/24",
    sshKeyName: stack,
  });
} else if (stack == "prod") {
  stackResources = new CoreStack(stack, {
    zoneName: "api.recruitinstantly.com",
    cidrBlock: "10.0.0.0/18",
    zoneId: "Z01312652ZZTOLESNGTMH",
    numberOfNatGateways: 1,
    sshKeyName: stack,
    skipCertValidation:true
  });
}
export const vpc = {
  id: stackResources.vpc.id,
  privateSubnetsIds: stackResources.vpc.privateSubnetIds,
  publicSubnetsIds: stackResources.vpc.publicSubnetIds
};

export const ecsCluster = {
  id: stackResources.ecsCluster.id,
  arn: stackResources.ecsCluster.arn,
  name: stackResources.ecsCluster.name
};
export const db = {
  securityGroupId: stackResources.db.sg.id,
  secretArn: stackResources.db.secret.arn
};


export const secrets = stackResources.secrets;
export const hostedZoneId = stackResources.hostedZoneId;
export const domain = stackResources.domain;

export const certificates = {
  certificateArn: stackResources.certificate.arn,
  cloudfrontCertificateArn: stackResources.cloudfrontCertificate.arn
};
export const bastion = {
  ip: stackResources.bastion?.instance?.publicIp,
  securityGroupId: stackResources.bastion?.sg.id
};
