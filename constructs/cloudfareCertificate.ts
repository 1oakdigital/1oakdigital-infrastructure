import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { Output } from "@pulumi/pulumi/output";
import { CertificateArgs } from "./types";
import * as cloudflare from "@pulumi/cloudflare";
import { CloudflareDomain, domainZoneMap } from "./domains";

export class CloudflareAcmCertificate {
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

    const certValidationRecords: pulumi.Output<cloudflare.Record[]> =
      this.certificate.domainValidationOptions.apply((opts) =>
        Object.entries(
          opts.reduce((acc, record) => {
            // dedup by the record's name
            acc[record.resourceRecordName] = record;
            return acc;
          }, {} as { [key: string]: aws.types.output.acm.CertificateDomainValidationOption })
        ).map(
          ([name, record], i) =>
            new cloudflare.Record(
              `${props.domainName}-cf-validation-record-${i}`,
              {
                name,
                zoneId: props.zoneId,
                ttl: 3600,
                type: "CNAME",
                value: record.resourceRecordValue,
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
          rs.map((r) => r.hostname)
        ),
      },
      { retainOnDelete: true }
    );

    this.arn = this.certificate.arn;
  }
}

export interface CloudflareAcmCertificateV2Props {
  subdomain?: string;
  domainName: string;
  subjectAlternativeNames: string[];
}

export class CloudflareAcmCertificateV2 {
  readonly certificate: aws.acm.Certificate;
  readonly arn: Output<string>;

  constructor(
    baseName: string,
    props: CloudflareAcmCertificateV2Props,
  ) {

    this.certificate = new aws.acm.Certificate(
      baseName,
      {
        domainName: props.domainName,
        subjectAlternativeNames: props.subjectAlternativeNames,
        validationMethod: "DNS",
      },
      {
        retainOnDelete: true,
      }
    );

    const certValidationRecords: pulumi.Output<cloudflare.Record[]> =
      this.certificate.domainValidationOptions.apply((opts) =>
        Object.entries(
          opts.reduce((acc, record) => {
            // dedup by the record's name
              if (record.domainName.indexOf("*") != 0)
             acc[record.resourceRecordName] = record;

            return acc;
          }, {} as { [key: string]: aws.types.output.acm.CertificateDomainValidationOption })
        ).map(
          ([name, record], i) => {
              const zoneId= domainZoneMap[
                              record.domainName.split(".").slice(-2).join(".")
                              ]
              return new cloudflare.Record(
                  `${name}-${zoneId}.${i}`,
                  {
                      name,
                      zoneId,
                      // ttl: 3600,
                      type: "CNAME",
                      value: record.resourceRecordValue,
                  },
                  {deleteBeforeReplace: true}
              )
          }
        )
      );


    new aws.acm.CertificateValidation(
      `${baseName}-validation`,
      {
        certificateArn: this.certificate.arn,
        validationRecordFqdns: certValidationRecords.apply((rs) =>
          rs.map((r) => r.hostname)
        ),
      },
      { retainOnDelete: true }
    );

    this.arn = this.certificate.arn;
  }
}
