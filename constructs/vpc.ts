import * as awsx from "@pulumi/awsx";
import { NatGatewayStrategy } from "@pulumi/awsx/types/enums/ec2";
import * as aws from "@pulumi/aws";

export interface VpcProps {
  clusterName: string;
  cidrBlock?: string;
  numberOfAvailabilityZones?: number;
}
export class Vpc {
  readonly vpc: awsx.ec2.Vpc;

  constructor(
    stack: string,
    props: VpcProps,
    tags?: { [key: string]: string }
  ) {
    this.vpc = new awsx.ec2.Vpc(`${stack}-vpc`, {
      cidrBlock: props.cidrBlock ?? "10.0.0.0/18",
      numberOfAvailabilityZones: props.numberOfAvailabilityZones ?? 3,
      natGateways: { strategy: NatGatewayStrategy.Single },
      tags: { name: `${stack}-vpc`, ...tags },
      enableDnsHostnames: true,
    });

    // new aws.ec2.VpcEndpoint("vpc-endpoint-ec2", {
    //   vpcId: this.vpc.vpcId,
    //   serviceName: "com.amazonaws.eu-west-2.ec2",
    //   vpcEndpointType: "Interface",
    //   privateDnsEnabled: true,
    //   subnetIds: this.vpc.privateSubnetIds,
    // });
    new aws.ec2.VpcEndpoint("vpc-endpoint-securityhub", {
      vpcId: this.vpc.vpcId,
      serviceName: "com.amazonaws.eu-west-2.securityhub",
      vpcEndpointType: "Interface",
      privateDnsEnabled: true,
      subnetIds: this.vpc.privateSubnetIds,
    });

    this.vpc.privateSubnetIds.apply((subnets) =>
      subnets.forEach((subnetId) => {
        new aws.ec2.Tag(`${subnetId}-cluster-tag`, {
          resourceId: subnetId,
          key: `kubernetes.io/cluster/${props.clusterName}`,
          value: "shared",
        });
        new aws.ec2.Tag(`${subnetId}-elb-tag`, {
          resourceId: subnetId,
          key: "kubernetes.io/role/internal-elb",
          value: "1",
        });
      })
    );
    this.vpc.publicSubnetIds.apply((subnets) =>
      subnets.forEach((subnetId) => {
        new aws.ec2.Tag(`${subnetId}-cluster-tag`, {
          resourceId: subnetId,
          key: `kubernetes.io/cluster/${props.clusterName}`,
          value: "shared",
        });
        new aws.ec2.Tag(`${subnetId}-elb-tag`, {
          resourceId: subnetId,
          key: "kubernetes.io/role/elb",
          value: "1",
        });
      })
    );
  }
}
