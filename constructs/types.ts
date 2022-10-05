import { CertificateArgs as AcmCertificateArgs } from "@pulumi/aws/acm/certificate";
import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";

export interface CoreStackProps {
  zoneName: string;
  zoneId: string;
  domain?: string;
  certificateArn?: string;
  certificateId?: string;
  cidrBlock?: string;
  sshKeyName?: string;
  replication?: boolean;
  numberOfNatGateways?: number;
  skipCertValidation?: boolean;
}

export interface CertificateArgs extends AcmCertificateArgs {
  zoneId: string;
  skipValidation?: boolean;
}

export interface PostgresqlProps {
  name?: string;
  vpc: awsx.ec2.Vpc;
  subnetIds: pulumi.Input<pulumi.Input<string>[]>;
  masterPassword: string | pulumi.Output<string>;
  databaseName?: string;
  instanceClass?: string;
  backupRetentionPeriod?: number;
  engineVersion?: string;
  dbClusterParameterGroupName?: string;
}