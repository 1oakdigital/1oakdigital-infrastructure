import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";

export interface AuroraPostgresqlClusterProps {
  masterUsername: string | pulumi.Output<string>;
  vpc: awsx.ec2.Vpc;
  masterPassword: string | pulumi.Output<string>;
  databaseName?: string;
  instanceClass?: string;
  backupRetentionPeriod?: number;
  engineVersion?: string;
  dbClusterParameterGroupName?: string;
  snapshotIdentifier?: string;

  maxCapacity?:number
  minCapacity?:number
}


export const DB_PORT = 3306
export class AuroraPostgresqlServerlessCluster {
    readonly sg: aws.ec2.SecurityGroup;
    readonly cluster: aws.rds.Cluster;
    readonly secret: aws.secretsmanager.Secret;

    constructor(stack: string, props: AuroraPostgresqlClusterProps, tags?: { [key: string]: string }) {
        const constructName = props.databaseName ? `${stack}-${props.databaseName}` : stack;


        this.sg = new aws.ec2.SecurityGroup(`${constructName}-db-sg`, {
            vpcId: props.vpc.vpcId,
            egress: [
                {
                    cidrBlocks: ["0.0.0.0/0"],
                    protocol: "tcp",
                    fromPort: 0,
                    toPort: 65535,
                },
            ],
        });

        const subnetGroup = new aws.rds.SubnetGroup(`${constructName}-db-subnet-group`, {
            subnetIds: props.vpc.privateSubnetIds
        });

        this.cluster = new aws.rds.Cluster(
            `${constructName}-db-cluster`,
            {
                databaseName: props.databaseName,
                clusterIdentifier: `${constructName}-aurora-cluster`,
                engine: "aurora-mysql",
                engineMode: "provisioned",
                engineVersion: "8.0.mysql_aurora.3.02.1",
                serverlessv2ScalingConfiguration: {
                    maxCapacity: props.maxCapacity ?? 1,
                    minCapacity: props.minCapacity ?? 0.5,
                },
                masterUsername: props.masterUsername,
                masterPassword: props.masterPassword,
                vpcSecurityGroupIds: [this.sg.id],
                port: DB_PORT,
                dbClusterParameterGroupName: props.dbClusterParameterGroupName,
                snapshotIdentifier: props.snapshotIdentifier,
                skipFinalSnapshot: true,
                applyImmediately: true,
                storageEncrypted: true,
                deletionProtection: false,

                dbSubnetGroupName: subnetGroup.name,
                backupRetentionPeriod: props.backupRetentionPeriod ?? 1,
                tags,
            },
            {protect: true, retainOnDelete: false},
        )

        new aws.rds.ClusterInstance(`${constructName}-db-cluster-instance-writer`, {

            clusterIdentifier: this.cluster.id,
            instanceClass: "db.serverless",
            engine: "aurora-mysql",
            engineVersion: this.cluster.engineVersion,
        });

        this.secret = new aws.secretsmanager.Secret(`${constructName}-db-secret`, {
            name: `${constructName}/database`,
            tags,
        });
        new aws.secretsmanager.SecretVersion(`${constructName}-db-secret-version`, {
            secretId: this.secret.id,
            secretString: pulumi
                .all([props.masterPassword, this.cluster.masterUsername, this.cluster.endpoint, this.cluster.port])
                .apply(([masterPassword, masterUsername, endpoint, port]) =>
                    JSON.stringify({
                        password: masterPassword,
                        username: masterUsername,
                        host: endpoint,
                        port: port,
                        name: props.databaseName,
                        engine: "mysql"
                    }),
                ),
        })
    }
}
