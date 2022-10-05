import * as aws from "@pulumi/aws";
import {SecurityGroup} from "@pulumi/awsx/ec2/securityGroup";
import {PostgresqlProps} from "./types";
import * as pulumi from "@pulumi/pulumi";

export class PostgresqlInstance {
  readonly sg: SecurityGroup;
  readonly database: aws.rds.Instance;
  readonly secret: aws.secretsmanager.Secret;

  constructor(stack: string, props: PostgresqlProps, tags?: { [key: string]: string }) {
    const constructName = `${stack}-${props.name}`

    this.sg = new SecurityGroup(`db-${constructName}`, {
      vpc: props.vpc,
      egress: [
        {
          cidrBlocks: ["0.0.0.0/0"],
          protocol: "tcp",
          fromPort: 0,
          toPort: 65535,
        },
      ],
    });

    const subnetGroup = new aws.rds.SubnetGroup(`${constructName}-subnet-group`, {
      subnetIds: props.subnetIds,
    });

    this.database = new aws.rds.Instance(`${constructName}-db`, {
      identifier: constructName,
      allocatedStorage: 20,
      maxAllocatedStorage: 100,
      engine: "postgres",
      engineVersion: "14.2",
      instanceClass: "db.t4g.micro",
      dbName: props.name,
      vpcSecurityGroupIds: [this.sg.id],
      publiclyAccessible: false,
      performanceInsightsEnabled: false,
      dbSubnetGroupName: subnetGroup.name,
      password: props.masterPassword,
      skipFinalSnapshot: true,
      username: "postgres"
    });


    this.secret = new aws.secretsmanager.Secret(`${constructName}-db-secret`, {
      name: `${stack}/${props.name}/db-secret`,
      tags,
    });
    new aws.secretsmanager.SecretVersion(`${constructName}-secret-version`, {
      secretId: this.secret.id,
      secretString: pulumi
        .all([props.masterPassword, this.database.username, this.database.endpoint, this.database.port])
        .apply(([masterPassword, masterUsername, endpoint, port]) =>
          JSON.stringify({
            password: masterPassword,
            username: masterUsername,
            host: endpoint,
            port: port,
            name: props.name,
            engine: "postgres"
          }),
        ),
    })
  }
}
