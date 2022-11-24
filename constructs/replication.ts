import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { Config, Output} from "@pulumi/pulumi";
import {DB_PORT} from "./database";

export interface DmsReplicationProps {
    vpc: awsx.ec2.Vpc;
    replicationMapping: { [name: string]: any };
}

const settings = {
    "StreamBufferSettings": {
        "StreamBufferCount": 3,
        "CtrlStreamBufferSizeInMB": 5,
        "StreamBufferSizeInMB": 8
    },
    "ErrorBehavior": {
        "FailOnNoTablesCaptured": true,
        "ApplyErrorUpdatePolicy": "LOG_ERROR",
        "FailOnTransactionConsistencyBreached": false,
        "RecoverableErrorThrottlingMax": 1800,
        "DataErrorEscalationPolicy": "SUSPEND_TABLE",
        "ApplyErrorEscalationCount": 0,
        "RecoverableErrorStopRetryAfterThrottlingMax": true,
        "RecoverableErrorThrottling": true,
        "ApplyErrorFailOnTruncationDdl": false,
        "DataTruncationErrorPolicy": "LOG_ERROR",
        "ApplyErrorInsertPolicy": "LOG_ERROR",
        "EventErrorPolicy": "IGNORE",
        "ApplyErrorEscalationPolicy": "LOG_ERROR",
        "RecoverableErrorCount": -1,
        "DataErrorEscalationCount": 0,
        "TableErrorEscalationPolicy": "STOP_TASK",
        "RecoverableErrorInterval": 5,
        "ApplyErrorDeletePolicy": "IGNORE_RECORD",
        "TableErrorEscalationCount": 0,
        "FullLoadIgnoreConflicts": true,
        "DataErrorPolicy": "LOG_ERROR",
        "TableErrorPolicy": "SUSPEND_TABLE"
    },
    "TTSettings": {
        "TTS3Settings": null,
        "TTRecordSettings": null,
        "EnableTT": false
    },
    "FullLoadSettings": {
        "CommitRate": 10000,
        "StopTaskCachedChangesApplied": false,
        "StopTaskCachedChangesNotApplied": false,
        "MaxFullLoadSubTasks": 8,
        "TransactionConsistencyTimeout": 600,
        "CreatePkAfterFullLoad": false,
        "TargetTablePrepMode": "DO_NOTHING"
    },
    "TargetMetadata": {
        "ParallelApplyBufferSize": 0,
        "ParallelApplyQueuesPerThread": 0,
        "ParallelApplyThreads": 0,
        "TargetSchema": "",
        "InlineLobMaxSize": 0,
        "ParallelLoadQueuesPerThread": 0,
        "SupportLobs": true,
        "LobChunkSize": 0,
        "TaskRecoveryTableEnabled": false,
        "ParallelLoadThreads": 0,
        "LobMaxSize": 32,
        "BatchApplyEnabled": false,
        "FullLobMode": false,
        "LimitedSizeLobMode": true,
        "LoadMaxFileSize": 0,
        "ParallelLoadBufferSize": 0
    },
    "BeforeImageSettings": null,
    "ControlTablesSettings": {
        "historyTimeslotInMinutes": 5,
        "HistoryTimeslotInMinutes": 5,
        "StatusTableEnabled": false,
        "SuspendedTablesTableEnabled": false,
        "HistoryTableEnabled": false,
        "ControlSchema": "",
        "FullLoadExceptionTableEnabled": false
    },
    "LoopbackPreventionSettings": null,
    "CharacterSetSettings": null,
    "FailTaskWhenCleanTaskResourceFailed": false,
    "ChangeProcessingTuning": {
        "StatementCacheSize": 50,
        "CommitTimeout": 1,
        "BatchApplyPreserveTransaction": true,
        "BatchApplyTimeoutMin": 1,
        "BatchSplitSize": 0,
        "BatchApplyTimeoutMax": 30,
        "MinTransactionSize": 1000,
        "MemoryKeepTime": 60,
        "BatchApplyMemoryLimit": 500,
        "MemoryLimitTotal": 1024
    },
    "ChangeProcessingDdlHandlingPolicy": {
        "HandleSourceTableDropped": true,
        "HandleSourceTableTruncated": true,
        "HandleSourceTableAltered": true
    },
    "PostProcessingRules": null
}

export class DmsReplication {
    readonly sg: aws.ec2.SecurityGroup;

    constructor(stack: string, props: DmsReplicationProps) {
        const dmsAssumeRole = aws.iam.getPolicyDocument({
            statements: [
                {
                    actions: ["sts:AssumeRole"],
                    principals: [
                        {
                            identifiers: ["dms.amazonaws.com"],
                            type: "Service",
                        },
                    ],
                },
            ],
        });
        const dms_access_for_endpoint = new aws.iam.Role(
            "dms-access-for-endpoint",
            {
                assumeRolePolicy: dmsAssumeRole.then(
                    (dmsAssumeRole) => dmsAssumeRole.json
                ),
            }
        );
        const dms_access_for_endpoint_AmazonDMSRedshiftS3Role =
            new aws.iam.RolePolicyAttachment(
                "dms-access-for-endpoint-AmazonDMSRedshiftS3Role",
                {
                    policyArn:
                        "arn:aws:iam::aws:policy/service-role/AmazonDMSRedshiftS3Role",
                    role: dms_access_for_endpoint.name,
                }
            );
        const dms_cloudwatch_logs_role = new aws.iam.Role(
            "dms-cloudwatch-logs-role",
            {
                assumeRolePolicy: dmsAssumeRole.then(
                    (dmsAssumeRole) => dmsAssumeRole.json
                ),
            }
        );
        const dms_cloudwatch_logs_role_AmazonDMSCloudWatchLogsRole =
            new aws.iam.RolePolicyAttachment(
                "dms-cloudwatch-logs-role-AmazonDMSCloudWatchLogsRole",
                {
                    policyArn:
                        "arn:aws:iam::aws:policy/service-role/AmazonDMSCloudWatchLogsRole",
                    role: dms_cloudwatch_logs_role.name,
                }
            );
        const dms_vpc_role = new aws.iam.Role("dms-vpc-role", {
            assumeRolePolicy: dmsAssumeRole.then(
                (dmsAssumeRole) => dmsAssumeRole.json
            ),
        });
        const dms_vpc_role_AmazonDMSVPCManagementRole =
            new aws.iam.RolePolicyAttachment(
                "dms-vpc-role-AmazonDMSVPCManagementRole",
                {
                    policyArn:
                        "arn:aws:iam::aws:policy/service-role/AmazonDMSVPCManagementRole",
                    role: dms_vpc_role.name,
                }
            );
        // Create a new replication instance

        this.sg = new aws.ec2.SecurityGroup(`${stack}-dms-sg`, {
            vpcId: props.vpc.vpcId,
            ingress: [
                {
                    cidrBlocks: ["0.0.0.0/0"],
                    protocol: "tcp",
                    fromPort: 0,
                    toPort: 65535,
                },
            ],
            egress: [
                {
                    cidrBlocks: ["0.0.0.0/0"],
                    protocol: "tcp",
                    fromPort: 0,
                    toPort: 65535,
                },
            ],
        });

        const replicationInstance = new aws.dms.ReplicationInstance(
            `${stack}-replication-instance`,
            {
                allocatedStorage: 50,
                applyImmediately: true,
                engineVersion: "3.4.7",
                multiAz: false,
                publiclyAccessible: true,
                replicationInstanceClass: "dms.t3.medium",
                replicationInstanceId: `${stack}-dms-replication-instance`,
                replicationSubnetGroupId: "prod-replication",
                vpcSecurityGroupIds: [this.sg.id],
            },
            {
                dependsOn: [
                    dms_access_for_endpoint_AmazonDMSRedshiftS3Role,
                    dms_cloudwatch_logs_role_AmazonDMSCloudWatchLogsRole,
                    dms_vpc_role_AmazonDMSVPCManagementRole,
                ],
            }
        );
        const config = new Config();

        const dbMap = {
            admin: {
                serverName: "dating-admin-do-user-7412958-0.b.db.ondigitalocean.com",
                password: config.requireSecret('db-admin-password'),
                sites: ["admin"],
            },
            "db-live-1": {
                serverName: "db-live-1-do-user-7412958-0.b.db.ondigitalocean.com",
                password: config.requireSecret('db-live-1-password'),
                sites: [
                    "yummyaffair",
                    "jijuneukt",
                    "lustpals",
                    "duknulla",
                    "mysecretfeels",
                    "aussiebang",
                ],
            },
            "db-live-2": {
                serverName: "db-live-2-do-user-7412958-0.b.db.ondigitalocean.com",
                password: config.requireSecret('db-live-2-password'),
                sites: [
                    "seekingcrush",
                    "follarico",
                    "ilsessuali",
                    "geheimerfick",
                    "loversnextdoor",
                ],
            },
            "db-live-3": {
                serverName: "db-live-3-do-user-7412958-0.b.db.ondigitalocean.com",
                password: config.requireSecret('db-live-3-password'),
                sites: [
                    "flingpals",
                    "honeynearby",
                    "laissebaiser",
                    "geheimneuken",
                    "myflingmate",
                ],
            },
            "db-live-4": {
                serverName: "db-live-4-do-user-7412958-0.b.db.ondigitalocean.com",
                password: config.requireSecret('db-live-4-password'),
                sites: [
                    "flirtytown",
                    "mycrushfinder",
                    "shag2night",
                    "sexosecreto",
                    "ragazzevicino",
                    "pouriouir",
                    "deliamigos",
                ],
            },
            "db-live-5": {
                serverName: "db-live-5-do-user-7412958-0.b.db.ondigitalocean.com",
                password: config.requireSecret('db-live-5-password'),
                sites: [
                    "bangtender",
                    "horneyfriends",
                    "meltingme",
                    "rabbitsmeet",
                    "spicywives",
                ],
            },
        };
        const usedSg: Output<string>[] = []
    for (const [key, value] of Object.entries(dbMap)) {
      value.sites.forEach((site: string) => {
        const sourceEndpoint = new aws.dms.Endpoint(
          `${stack}-${site}-source-endpoint`,
          {
            certificateArn:
              "arn:aws:dms:eu-west-2:707053725174:cert:S5CRWSUPEACLBYTOAGLDEF5NMC2N7J5ANQ55LXQ",
            databaseName: "defaultdb",
            endpointId: `${stack}-${site}-source-endpoint`,
            endpointType: "source",
            engineName: "mysql",
            password: value.password,
            port: 25060,
            serverName: value.serverName,
            sslMode: "verify-ca",
            username: "doadmin",
          }
        );
        if (props.replicationMapping[site]) {
          const { password, port, serverName, username, databaseName, sgId } =
            props.replicationMapping[site];
          const targetEndpoint = new aws.dms.Endpoint(
            `${stack}-${site}-target-endpoint`,
            {
              databaseName,
              endpointId: `${stack}-${site}-target-endpoint`,
              endpointType: "target",
              engineName: "aurora",
              password,
              port,
              serverName,
              username,
            }
          );
          if (!usedSg.includes(sgId))
          new aws.ec2.SecurityGroupRule(`${site}-dms-db-rule`, {
            type: "ingress",
            fromPort: DB_PORT,
            toPort: DB_PORT,
            protocol: "tcp",
            securityGroupId: sgId,
            sourceSecurityGroupId: this.sg.id,
          });
          usedSg.push(sgId)
          new aws.dms.ReplicationTask(`${stack}-${site}-replication-task`, {
            startReplicationTask: false,
            migrationType: "full-load-and-cdc",
            replicationInstanceArn: replicationInstance.replicationInstanceArn,
            replicationTaskId: `${stack}-${site}-replication-task`,
            replicationTaskSettings: JSON.stringify(settings),
            sourceEndpointArn: sourceEndpoint.endpointArn,
            tableMappings: JSON.stringify({
              rules: [
                {
                  "rule-type": "transformation",
                  "rule-id": "1",
                  "rule-name": "1",
                  "rule-target": "schema",
                  "object-locator": {
                    "schema-name": `${site}_live`,
                  },
                  "rule-action": "remove-suffix",
                  value: "_live",
                },
                {
                  "rule-type": "selection",
                  "rule-id": "2",
                  "rule-name": "2",
                  "object-locator": {
                    "schema-name": `${site}_live`,
                    "table-name": "%",
                  },
                  "rule-action": "include",
                },
              ],
            }),
            targetEndpointArn: targetEndpoint.endpointArn,
          }, {ignoreChanges:["replicationTaskSettings"]});
        }
      });
    }
  }
}
