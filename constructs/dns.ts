import * as k8s from "@pulumi/kubernetes";
import * as eks from "@pulumi/eks";
import * as aws from "@pulumi/aws";
import { splitIntoChunk } from "./helpers";
import { allDomains, CloudflareDomain } from "../configs/domains";
import { CloudflareAcmCertificateV2 } from "./cloudfareCertificate";
import * as pulumi from "@pulumi/pulumi";
import {controllerAffinity, coreControllerTaint} from "../configs/consts";
import {Output} from "@pulumi/pulumi/output";

export interface DnsConfigurationProps {
  subdomain?: string
  namespace: string
}

export class DnsConfiguration {
    certificates: Output<string>[]
    domains: string[]

  constructor(
    stack: string,
    props: DnsConfigurationProps,
  ) {
    const { subdomain, namespace } = props;


    this.certificates = [];
    this.domains = [];

    // Split domains into chunks of 5 (+ *.subdomains) since ACM can only hold 10 alternativeNames
    splitIntoChunk(allDomains, 5).forEach(
      (domainChunk: CloudflareDomain[], chunkIndex) => {
        const subjectAlternativeNames: string[] = [];
        domainChunk.forEach((cloudflareDomain, index) => {
          const domainName = subdomain
            ? `${subdomain}.${cloudflareDomain.domain}`
            : cloudflareDomain.domain;

          // Use first domain as root in certificate
          if (index !== 0) subjectAlternativeNames.push(domainName);
          this.domains.push(domainName);
          subjectAlternativeNames.push(`*.${domainName}`);
        });
        const certificate = new CloudflareAcmCertificateV2(
          `${stack}-${chunkIndex}-certificate`,
          {
            domainName: props.subdomain
              ? `${props.subdomain}.${domainChunk[0].domain}`
              : domainChunk[0].domain,
            subdomain: props.subdomain,
            subjectAlternativeNames,
          }
        );
        this.certificates.push(certificate.arn);
      }
    );

    // Cloudflare

    const cloudflareConfig = new pulumi.Config("cloudflare");
    new k8s.core.v1.Secret("cloudflare-credentials", {
      metadata: {
        name: "cloudflare-credentials",
        namespace
      },
      stringData: {
        CF_API_TOKEN: cloudflareConfig.requireSecret("apiToken"),
      },
    });
    new k8s.helm.v3.Release("helm-external-dns", {
      chart: "external-dns",
      name: "external-dns",
      version: "1.11.0",
      namespace: namespace,
      values: {
        extraArgs: ["--cloudflare-proxied"],
        env: [
          {
            name: "CF_API_TOKEN",
            valueFrom: {
              secretKeyRef: {
                name: "cloudflare-credentials",
                key: "CF_API_TOKEN",
              },
            },
          },
        ],
        serviceAccount: { create: true },
        provider: "cloudflare",
        affinity: controllerAffinity,
        tolerations: [coreControllerTaint],
      },
      repositoryOpts: {
        repo: "https://kubernetes-sigs.github.io/external-dns/",
      },
    });
  }
}
