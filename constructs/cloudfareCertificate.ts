import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import {Output} from "@pulumi/pulumi/output";
import {CertificateArgs} from "./types";
import * as cloudflare from "@pulumi/cloudflare";

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
                                value:record.resourceRecordValue
                            },
                            {deleteBeforeReplace: true, retainOnDelete: true}
                        )
                )
            );

        new aws.acm.CertificateValidation(
            `${props.domainName}-validation`,
            {
                certificateArn: this.certificate.arn,
                validationRecordFqdns: certValidationRecords.apply((rs) =>
                    rs.map((r) => r.hostname)
                )
            },
            {retainOnDelete: true}
        );


        this.arn = this.certificate.arn;
    }
}
