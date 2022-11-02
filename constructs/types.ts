import { CertificateArgs as AcmCertificateArgs } from "@pulumi/aws/acm/certificate";
import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";
import * as eks from "@pulumi/eks";
import {Output} from "@pulumi/pulumi/output";

export interface CoreStackProps {
  domains?: string[];
  subdomain?: string;
  cidrBlock?: string;
  sshKeyName?: string;
  replication?: boolean;
  numberOfNatGateways?: number;
  numberOfAvailabilityZones?: number;
  skipCertValidation?: boolean;
  // Each website will have its own database cluster
  databasePerSite?: boolean;
}

export interface CertificateArgs extends AcmCertificateArgs {
  zoneId: string;
  skipValidation?: boolean;
}


export interface RedisClusterProps {
  name?: string;
  vpc: awsx.ec2.Vpc;
  nodeType?: string;
  engineVersion?: string;
}

export interface EfsProps {
  cluster:eks.Cluster;
  vpc:awsx.ec2.Vpc;
  name:string
  efsId:string | Output<string>
}

