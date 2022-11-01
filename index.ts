import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { CoreStack } from './stack'

const stack = pulumi.getStack()
export const region = aws.config.requireRegion()
export const RELEASE = process.env.RELEASE ?? 'latest'

const currentAccount = aws.getCallerIdentity({})
export const accountId = currentAccount.then((account) => account.accountId)

// @ts-expect-error
let stackResources: CoreStack = {}

if (stack == 'dev') {
  stackResources = new CoreStack(stack, {
    cidrBlock: '10.0.0.0/18',
    subdomain: 'beta',
    sshKeyName: stack
  })
} else if (stack == 'prod') {
  stackResources = new CoreStack(stack, {
    cidrBlock: '10.0.0.0/16',
    sshKeyName: stack,
    subdomain: "v2"
  })
}
// export const kubeconfig = stackResources.kubeconfig
export const vpc = {
  id: stackResources.vpc.vpcId,
  privateSubnetsIds: stackResources.vpc.privateSubnetIds,
  publicSubnetsIds: stackResources.vpc.publicSubnetIds
}

export const eksCluster = {
  id: stackResources.cluster.eksCluster.id,
  arn: stackResources.cluster.eksCluster.arn,
  name: stackResources.cluster.eksCluster.name,
  nodeSecurityGroup: stackResources.cluster.nodeSecurityGroup.id,
  clusterSecurityGroup: stackResources.cluster.clusterSecurityGroup.id
}
export const dbCluster = {
    securityGroupId: stackResources.dbCluster.sg.id,
    secretArn: stackResources.dbCluster.secret.arn
};
export const cacheCluster = {
    securityGroupId: stackResources.cacheCluster.sg.id,
    clusterAddress: stackResources.cacheCluster.cluster.clusterAddress
};


export const secrets = stackResources.secrets;

export const bastion = {
    ip: stackResources.bastion?.instance?.publicIp,
    securityGroupId: stackResources.bastion?.sg.id
};
export const bucketName =stackResources.bucketName
export const websiteNameSpace = "websites"
