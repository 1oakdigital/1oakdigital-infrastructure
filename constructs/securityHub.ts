import * as aws from "@pulumi/aws";

export class SecurityHub {
  constructor(stack: string) {
    const hub = new aws.securityhub.Account("SecurityHubAccount");

    new aws.securityhub.StandardsSubscription(
      "PciDSS",
      {
        standardsArn:
          "arn:aws:securityhub:eu-west-2::standards/pci-dss/v/3.2.1",
      },
      {
        dependsOn: [hub],
      }
    );
    new aws.securityhub.StandardsSubscription(
      "cisAwsFoundationsBenchmark",
      {
        standardsArn:
          "arn:aws:securityhub:eu-west-2::standards/cis-aws-foundations-benchmark/v/1.4.0",
      },
      {
        dependsOn: [hub],
      }
    );
    new aws.securityhub.StandardsSubscription(
      "AwsFoundationalSecurityBestPractices",
      {
        standardsArn:
          "arn:aws:securityhub:eu-west-2::standards/aws-foundational-security-best-practices/v/1.0.0",
      },
      {
        dependsOn: [hub],
      }
    );

    // Security Hub findings reporting
    const securityEventsTopic = new aws.sns.Topic(`${stack}-events-topic`, {});
    const snsTopicPolicy = securityEventsTopic.arn.apply((arn) =>
      aws.iam.getPolicyDocumentOutput({
        statements: [
          {
            effect: "Allow",
            actions: ["SNS:Publish"],
            principals: [
              {
                type: "Service",
                identifiers: ["events.amazonaws.com"],
              },
            ],
            resources: [arn],
          },
        ],
      })
    );
    new aws.sns.TopicPolicy(`${stack}-topic-policy`, {
      arn: securityEventsTopic.arn,
      policy: snsTopicPolicy.apply((snsTopicPolicy) => snsTopicPolicy.json),
    });

    const securityEvents = new aws.cloudwatch.EventRule(
      `${stack}-security-events`,
      {
        description: "Security Hub events",
        eventPattern: JSON.stringify({
          source: ["aws.securityhub"],
          detail: {
            findings: {
              Severity: {
                Label: ["HIGH", "CRITICAL"],
              },
            },
          },
        }),
      }
    );
    new aws.cloudwatch.EventTarget(`${stack}-security-topic-target`, {
      rule: securityEvents.name,
      arn: securityEventsTopic.arn,
    });
  }
}
