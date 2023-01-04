import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { EnvironmentStack } from "./environmentStack";
import { AccountStack } from "./accountStack";

const stack = pulumi.getStack();
export const region = aws.config.requireRegion();
export const RELEASE = process.env.RELEASE ?? "latest";
export const config = new pulumi.Config();
const currentAccount = aws.getCallerIdentity({});
export const accountId = currentAccount.then((account) => account.accountId);

// @ts-expect-error
let stackResources: CoreStack = {};

if (stack == "dev") {
  stackResources = new EnvironmentStack(stack, {
    cidrBlock: "10.0.0.0/18",
    subdomain: "beta",
    sshKeyName: stack,
    nginxMinReplicas: 1,
    nginxMaxReplicas: 2,
    redisNodeType: "cache.t4g.medium",
    websitesDbMaxCapacity: 1,
    websitesDbMinCapacity: 0.5,
  });
} else if (stack == "prod") {
  stackResources = new EnvironmentStack(stack, {
    cidrBlock: "10.0.0.0/16",
    sshKeyName: stack,
    subdomain: "v2",
    databasePerSite: true,
    nginxMinReplicas: 2,
    nginxMaxReplicas: 3,
    redisNodeType: "cache.t4g.medium",
    websitesDbMaxCapacity: 1,
    websitesDbMinCapacity: 0.5,
  });
} else if (stack == "base") {
  // @ts-ignore
  stackResources = new AccountStack(stack);
}
export const vpc = {
  id: stackResources.vpc.vpcId,
  privateSubnetsIds: stackResources.vpc.privateSubnetIds,
  publicSubnetsIds: stackResources.vpc.publicSubnetIds,
};

export const eksCluster = {
  id: stackResources.cluster.eksCluster.id,
  arn: stackResources.cluster.eksCluster.arn,
  name: stackResources.cluster.eksCluster.name,
  nodeSecurityGroup: stackResources.cluster.nodeSecurityGroup.id,
  clusterSecurityGroup: stackResources.cluster.clusterSecurityGroup.id,
  clusterOidcProvider: stackResources.clusterOidcProvider,
};
export const dbCluster = {
  securityGroupId: stackResources.dbCluster.sg.id,
  secretArn: stackResources.dbCluster.secret.arn,
};
export const cacheCluster = {
  securityGroupId: stackResources.cacheCluster.sg.id,
  clusterAddress: stackResources.cacheCluster.cluster.clusterAddress,
};

export const websiteSecrets = stackResources.websiteSecrets;

export const bastion = {
  ip: stackResources.bastion?.instance?.publicIp,
  securityGroupId: stackResources.bastion?.sg.id,
};
export const bucket = {
  arn: stackResources.bucket.arn,
  name: stackResources.bucket.bucket,
};
export const websiteNameSpace = "websites";
