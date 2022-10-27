import * as aws from "@pulumi/aws";
import {RedisClusterProps} from "./types";

export const REDIS_PORT = 6379;

export class RedisCluster {
  readonly sg:  aws.ec2.SecurityGroup;
  readonly cluster: aws.elasticache.Cluster;

  constructor(stack: string, props: RedisClusterProps, tags?: { [key: string]: string }) {
    const constructName = props.name ? `${stack}-${props.name}` : stack;


    this.sg = new aws.ec2.SecurityGroup(
      `${constructName}-redis-sg`,
      {
        vpcId: props.vpc.vpcId,
        egress: [
          {
            cidrBlocks: ["0.0.0.0/0"],
            protocol: "tcp",
            fromPort: 0,
            toPort: 65535,
          },
        ],
      },
      tags,
    );

    const subnetGroup = new aws.elasticache.SubnetGroup(`${constructName}-redis-subnet-group`, {
      subnetIds: props.vpc.privateSubnetIds
    });
    this.cluster = new aws.elasticache.Cluster(
      `${stack}-redis-cluster`,
      {
        engine: "redis",
        engineVersion: props.engineVersion || "6.2",
        nodeType: props.nodeType ?? "cache.t4g.micro",
        numCacheNodes: 1,
        securityGroupIds: [this.sg.id],
        subnetGroupName: subnetGroup.name,
        parameterGroupName: "default.redis6.x",
        port: REDIS_PORT,
      },
      tags,
    );
  }
}
