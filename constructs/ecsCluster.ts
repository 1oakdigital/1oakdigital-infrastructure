import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

export interface ClusterProps {
  vpc: awsx.ec2.Vpc;
}

export class EcsCluster {
  name: string;
  cluster: aws.ecs.Cluster;

  constructor(
    stack: string,
    props: ClusterProps,
    tags?: pulumi.Input<aws.Tags>
  ) {
    this.name = `recruit-instantly-${stack}`;
    const cluster = new awsx.ecs.Cluster(`${stack}-cluster`, {
      name: `recruit-instantly-${stack}`,
      securityGroups: [],
      settings: [
        {
          name: "containerInsights",
          value: "enabled",
        },
      ],
      vpc: props.vpc,
      tags,
    });
    this.cluster = cluster.cluster;
  }
}
