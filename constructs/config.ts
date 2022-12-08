import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export class AwsConfig {
  constructor(stack: string) {
    const bucket = new aws.s3.BucketV2(`${stack}-skyloop-aws-config`);
    const deliveryChannel = new aws.cfg.DeliveryChannel(
      "skyloopDeliveryChannel",
      { s3BucketName: bucket.bucket }
    );
    const role = new aws.iam.Role("awsConfigRole", {
      assumeRolePolicy: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "config.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
`,
    });
    new aws.iam.RolePolicyAttachment("awsConfigRolePolicyAttachment", {
      role: role.name,
      policyArn: "arn:aws:iam::aws:policy/service-role/AWS_ConfigRole",
    });
    const recorder = new aws.cfg.Recorder("Recorder", { roleArn: role.arn });
    new aws.iam.RolePolicy("recorderRolePolicy", {
      role: role.id,
      policy: pulumi.interpolate`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": [
        "s3:*"
      ],
      "Effect": "Allow",
      "Resource": [
        "${bucket.arn}",
        "${bucket.arn}/*"
      ]
    }
  ]
}
`,
    });
    new aws.cfg.RecorderStatus(
      "RecorderStatus",
      { isEnabled: true, name: recorder.name },
      {
        dependsOn: [deliveryChannel],
      }
    );
    const conformancePackBucket = new aws.s3.BucketV2(
      `${stack}-skyloop-conformance-pack`,
      {}
    );
    const packs = [
      // "https://raw.githubusercontent.com/awslabs/aws-config-rules/master/aws-config-conformance-packs/Security-Best-Practices-for-AWS-WAF.yaml",
      "https://raw.githubusercontent.com/awslabs/aws-config-rules/master/aws-config-conformance-packs/Security-Best-Practices-for-CloudTrail.yaml",
      "https://raw.githubusercontent.com/awslabs/aws-config-rules/master/aws-config-conformance-packs/Operational-Best-Practices-for-Security-Services.yaml",
      "https://raw.githubusercontent.com/awslabs/aws-config-rules/master/aws-config-conformance-packs/Operational-Best-Practices-for-Load-Balancing.yaml",
      // "https://raw.githubusercontent.com/awslabs/aws-config-rules/master/aws-config-conformance-packs/Operational-Best-Practices-for-Encryption-and-Keys.yaml",
      "https://raw.githubusercontent.com/awslabs/aws-config-rules/master/aws-config-conformance-packs/Operational-Best-Practices-for-Compute-Services.yaml",
      "https://raw.githubusercontent.com/awslabs/aws-config-rules/master/aws-config-conformance-packs/Operational-Best-Practices-for-CIS-Top20.yaml",
      "https://raw.githubusercontent.com/awslabs/aws-config-rules/master/aws-config-conformance-packs/Security-Best-Practices-for-RDS.yaml",
      "https://raw.githubusercontent.com/awslabs/aws-config-rules/master/aws-config-conformance-packs/Security-Best-Practices-for-EKS.yaml",
    ];
    packs.forEach((pack) => {
      // @ts-ignore
      const packName: string = pack.split("/").pop();
      const packResourceName = packName.split(".")[0];

      const bucketObject = new aws.s3.BucketObjectv2(
        `${packResourceName}S3Object`,
        {
          bucket: conformancePackBucket.id,
          key: packName,
          source: new pulumi.asset.RemoteAsset(pack),
        }
      );
      new aws.cfg.ConformancePack(
        packResourceName,
        {
          templateS3Uri: pulumi.interpolate`s3://${bucketObject.bucket}/${bucketObject.key}`,
        },
        {
          dependsOn: [recorder],
        }
      );
    });
  }
}
