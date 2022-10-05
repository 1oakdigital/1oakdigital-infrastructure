import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Output } from "@pulumi/pulumi/output";
import { CertificateArgs } from "./types";

export class Certificate {
  readonly certificate: aws.acm.Certificate;
  readonly arn: Output<string>;

  constructor(
    certName: string,
    props: CertificateArgs,
    tags?: { [key: string]: string }
  ) {
    this.certificate = new aws.acm.Certificate(certName, props, {
      retainOnDelete: true,
    });
    if (!props.skipValidation){
      const certValidationRecords: pulumi.Output<aws.route53.Record[]> =
        this.certificate.domainValidationOptions.apply((opts) =>
          Object.entries(
            opts.reduce((acc, record) => {
              // dedup by the record's name
              acc[record.resourceRecordName] = record;
              return acc;
            }, {} as { [key: string]: aws.types.output.acm.CertificateDomainValidationOption })
          ).map(
            ([name, record], i) =>
              new aws.route53.Record(
                `${props.domainName}-validation-record-${i}`,
                {
                  name,
                  zoneId: props.zoneId,
                  ttl: 60,
                  type: record.resourceRecordType,
                  records: [record.resourceRecordValue]
                },
                { deleteBeforeReplace: true, retainOnDelete: true }
              )
          )
        );
      new aws.acm.CertificateValidation(
        `${props.domainName}-validation`,
        {
          certificateArn: this.certificate.arn,
          validationRecordFqdns: certValidationRecords.apply((rs) =>
            rs.map((r) => r.fqdn)
          )
        },
        { retainOnDelete: true }
      );
    }

    this.arn = this.certificate.arn;
  }
}
