import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as gcp from "@pulumi/gcp";
import { region } from "./index";
import { SecurityHub } from "./constructs/securityHub";
import { AwsConfig } from "./constructs/config";

export class AccountStack {
  constructor(stack: string) {
    const tags = { stack: stack };
    const accountId = "707053725174";
    const phpFmpRepository = new aws.ecr.Repository("php-fpm-repository", {
      name: "php-fpm",
    });
    const phpCliRepository = new aws.ecr.Repository("php-cli-repository", {
      name: "php-cli",
    });

    // Reporting

    const reportBucket = new aws.s3.BucketV2(`reports`);
    new aws.s3.BucketVersioningV2("reportBucketVersioning", {
      bucket: reportBucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });
    new aws.s3.BucketServerSideEncryptionConfigurationV2(
      "reportBucketEncryption",
      {
        bucket: reportBucket.bucket,
        rules: [
          {
            bucketKeyEnabled: true,
            applyServerSideEncryptionByDefault: {
              sseAlgorithm: "aws:kms",
            },
          },
        ],
      }
    );
    new aws.s3.BucketPublicAccessBlock("reportBucketAccessBlock", {
      bucket: reportBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    const gcpUser = new aws.iam.User("gcp-s3-importer", {
      name: "gcp-s3-importer",
    });
    const gcpUserAccessKey = new aws.iam.AccessKey(
      "gcp-s3-importer-access-key",
      {
        user: gcpUser.name,
      },
      {
        additionalSecretOutputs: ["secret"],
      }
    );
    const gcpUserPolicy = new aws.iam.Policy("gcp-user-policy", {
      policy: reportBucket.arn.apply((arn) =>
        JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Action: [
                "s3:GetBucketAcl",
                "s3:PutObject",
                "s3:DeleteObject",
                "s3:GetObject",
                "s3:GetObjectAcl",
              ],
              Resource: [arn, `${arn}/*`],
            },
          ],
        })
      ),
    });
    new aws.iam.UserPolicyAttachment("gcp-user-policy-attachment", {
      user: gcpUser.name,
      policyArn: gcpUserPolicy.arn,
    });

    const dataset = new gcp.bigquery.Dataset("reports-dataset", {
      datasetId: "skyloop_dating_reports",
      friendlyName: "Skyloop Dating Reports",
      description: "Skyloop Dating Reports",
      location: "US",
      defaultTableExpirationMs: 3600000 * 30 * 12,
    });

    new gcp.bigquery.DataTransferConfig("reports-transfer", {
      displayName: "reports-transfer",
      location: "US",
      dataSourceId: "amazon_s3",
      schedule: "first sunday of quarter 00:00",
      destinationDatasetId: dataset.datasetId,
      params: {
        destination_table_name_template: "sales",
        data_path: pulumi.interpolate`s3://${reportBucket.bucket}/sales.csv`,
        access_key_id: gcpUserAccessKey.id,
        secret_access_key: gcpUserAccessKey.secret,
        file_format: "CSV",
        field_delimiter: ",",
        skip_leading_rows: "1",
        allow_quoted_newlines: "true",
        allow_jagged_rows: "true",
      },
    });

    // Security

    const accessLoggingBucket = new aws.s3.BucketV2(`AccessLoggingBucket`);
    new aws.s3.BucketVersioningV2("AccessLoggingBucketVersioning", {
      bucket: accessLoggingBucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });
    new aws.s3.BucketAclV2("accessLoggingBucketAcl", {
      bucket: accessLoggingBucket.id,
      acl: "log-delivery-write",
    });
    new aws.s3.BucketServerSideEncryptionConfigurationV2(
      "accessLoggingBucketEncryption",
      {
        bucket: accessLoggingBucket.bucket,
        rules: [
          {
            bucketKeyEnabled: true,
            applyServerSideEncryptionByDefault: {
              sseAlgorithm: "aws:kms",
            },
          },
        ],
      }
    );
    new aws.s3.BucketPublicAccessBlock("AccessLoggingBucketPublicAccessBlock", {
      bucket: accessLoggingBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    const flowLogBucket = new aws.s3.BucketV2(`${stack}-vpc-flow-log-bucket`, {
      loggings: [
        { targetBucket: accessLoggingBucket.bucket, targetPrefix: "flow-logs" },
      ],
    });

    new AwsConfig(stack);

    // IAM
    new aws.accessanalyzer.Analyzer("IamAccessAnalyzer", {
      analyzerName: "BaseAnalyzer",
    });
    new aws.iam.AccountPasswordPolicy("AccountPasswordPolicy", {
      allowUsersToChangePassword: true,
      minimumPasswordLength: 14,
      requireLowercaseCharacters: true,
      requireNumbers: true,
      requireSymbols: true,
      requireUppercaseCharacters: true,
      passwordReusePrevention: 1,
      maxPasswordAge: 90,
    });

    new aws.guardduty.Detector("GuardDutyDetector", {
      datasources: {
        s3Logs: {
          enable: true,
        },
      },
      enable: true,
    });

    // Cloud Trail
    const cloudTrailKey = new aws.kms.Key(`cloudtrail-kms`, {
      customerMasterKeySpec: "SYMMETRIC_DEFAULT",
      keyUsage: "ENCRYPT_DECRYPT",
      description: "encrypts cloudtrail events",
      tags,
      // policy: pulumi.all([accountId]).apply((accountId) =>
      //
      // ),
      policy: JSON.stringify({
        Version: "2012-10-17",
        Id: "Key policy created by CloudTrail",
        Statement: [
          {
            Sid: "Enable IAM User Permissions",
            Effect: "Allow",
            Principal: {
              AWS: ["arn:aws:iam::707053725174:root"],
            },
            Action: "kms:*",
            Resource: "*",
          },
          {
            Sid: "Allow CloudTrail to encrypt logs",
            Effect: "Allow",
            Principal: {
              Service: "cloudtrail.amazonaws.com",
            },
            Action: "kms:GenerateDataKey*",
            Resource: "*",
            Condition: {
              StringEquals: {
                "AWS:SourceArn":
                  "arn:aws:cloudtrail:eu-west-2:707053725174:trail/base-trail",
              },
              StringLike: {
                "kms:EncryptionContext:aws:cloudtrail:arn":
                  "arn:aws:cloudtrail:*:707053725174:trail/*",
              },
            },
          },
          {
            Sid: "Allow CloudTrail to describe key",
            Effect: "Allow",
            Principal: {
              Service: "cloudtrail.amazonaws.com",
            },
            Action: "kms:DescribeKey",
            Resource: "*",
          },
          {
            Sid: "Allow principals in the account to decrypt log files",
            Effect: "Allow",
            Principal: {
              AWS: "*",
            },
            Action: ["kms:Decrypt", "kms:ReEncryptFrom"],
            Resource: "*",
            Condition: {
              StringEquals: {
                "kms:CallerAccount": "707053725174",
              },
              StringLike: {
                "kms:EncryptionContext:aws:cloudtrail:arn":
                  "arn:aws:cloudtrail:*:707053725174:trail/*",
              },
            },
          },
          {
            Sid: "Allow alias creation during setup",
            Effect: "Allow",
            Principal: {
              AWS: "*",
            },
            Action: "kms:CreateAlias",
            Resource: "*",
            Condition: {
              StringEquals: {
                "kms:CallerAccount": "707053725174",
                "kms:ViaService": "ec2.eu-west-2.amazonaws.com",
              },
            },
          },
          {
            Sid: "Enable cross account log decryption",
            Effect: "Allow",
            Principal: {
              AWS: "*",
            },
            Action: ["kms:Decrypt", "kms:ReEncryptFrom"],
            Resource: "*",
            Condition: {
              StringEquals: {
                "kms:CallerAccount": "707053725174",
              },
              StringLike: {
                "kms:EncryptionContext:aws:cloudtrail:arn":
                  "arn:aws:cloudtrail:*:707053725174:trail/*",
              },
            },
          },
        ],
      }),
    });
    const cloudtrailLogsGroup = new aws.cloudwatch.LogGroup("cloudtrail-logs", {
      name: "cloudtrail-logs",
      tags: { stack },
    });
    const cloudtrailCloudwatchRole = new aws.iam.Role(
      "base-trail-cloudwatch-role",
      {
        assumeRolePolicy: {
          Version: "2012-10-17",
          Statement: [
            {
              Action: "sts:AssumeRole",
              Principal: {
                Service: "cloudtrail.amazonaws.com",
              },
              Effect: "Allow",
            },
          ],
        },
        inlinePolicies: [
          {
            name: "cloudwatch",
            policy: cloudtrailLogsGroup.arn.apply((arn) =>
              JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                  {
                    Sid: "AWSCloudTrailCreateLogStream2014110",
                    Effect: "Allow",
                    Action: ["logs:CreateLogStream"],
                    Resource: [`${arn}:log-stream:*`],
                  },
                  {
                    Sid: "AWSCloudTrailPutLogEvents20141101",
                    Effect: "Allow",
                    Action: ["logs:PutLogEvents"],
                    Resource: [`${arn}:log-stream:*`],
                  },
                ],
              })
            ),
          },
        ],
      }
    );
    const baseTrailBucket = new aws.s3.BucketV2("base-trail-bucket", {
      bucket: "skyloop-trails",
      policy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [
          {
            Sid: "AWSCloudTrailAclCheck20150319",
            Effect: "Allow",
            Principal: { Service: "cloudtrail.amazonaws.com" },
            Action: "s3:GetBucketAcl",
            Resource: "arn:aws:s3:::skyloop-trails",
            Condition: {
              StringEquals: {
                "aws:SourceArn": `arn:aws:cloudtrail:${region}:${accountId}:trail/base-trail`,
              },
            },
          },
          {
            Sid: "AWSCloudTrailWrite20150319",
            Effect: "Allow",
            Principal: { Service: "cloudtrail.amazonaws.com" },
            Action: "s3:PutObject",
            Resource: `arn:aws:s3:::skyloop-trails/AWSLogs/${accountId}/*`,
            Condition: {
              StringEquals: {
                "s3:x-amz-acl": "bucket-owner-full-control",
                "aws:SourceArn": `arn:aws:cloudtrail:${region}:${accountId}:trail/base-trail`,
              },
            },
          },
        ],
      }),
    });
    new aws.s3.BucketVersioningV2("baseTrailBucketVersioning", {
      bucket: accessLoggingBucket.id,
      versioningConfiguration: {
        status: "Enabled",
      },
    });
    new aws.s3.BucketAclV2("baseTrailBucketAcl", {
      bucket: accessLoggingBucket.id,
      acl: "log-delivery-write",
    });
    new aws.s3.BucketServerSideEncryptionConfigurationV2(
      "baseTrailBucketEncryption",
      {
        bucket: accessLoggingBucket.bucket,
        rules: [
          {
            bucketKeyEnabled: true,
            applyServerSideEncryptionByDefault: {
              sseAlgorithm: "aws:kms",
            },
          },
        ],
      }
    );
    new aws.s3.BucketPublicAccessBlock("baseTrailBucketPublicAccessBlock", {
      bucket: accessLoggingBucket.id,
      blockPublicAcls: true,
      blockPublicPolicy: true,
      ignorePublicAcls: true,
      restrictPublicBuckets: true,
    });

    new aws.cloudtrail.Trail("base-trail", {
      name: "base-trail",
      isMultiRegionTrail: true,
      enableLogFileValidation: true,
      s3BucketName: baseTrailBucket.bucket,
      cloudWatchLogsGroupArn: pulumi.interpolate`${cloudtrailLogsGroup.arn}:*`,
      cloudWatchLogsRoleArn: cloudtrailCloudwatchRole.arn,
      // eventSelectors: [],
      kmsKeyId: cloudTrailKey.arn,
      insightSelectors: [
        { insightType: "ApiCallRateInsight" },
        { insightType: "ApiErrorRateInsight" },
      ],
    });

    new SecurityHub(stack);
  }
}
