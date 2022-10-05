import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import { Output } from "@pulumi/pulumi/output";
import { ID } from "@pulumi/pulumi/resource";
import { SecurityGroup } from "@pulumi/awsx/ec2/securityGroup";
import * as pulumi from "@pulumi/pulumi";

export class BastionHost {
  /**  Bastion - a single EC2 instance that we can ssh into, providing a view into the rest of the network. */

  readonly sg: SecurityGroup;
  readonly instance?: aws.ec2.Instance;

  constructor(
    stack: string,
    vpc: awsx.ec2.Vpc,
    sshKeyName: string,
    domain: string,
    zoneId?: string | Output<ID>,
    tags?: { [key: string]: string }
  ) {
    const bastionKeyPair = aws.ec2.KeyPair.get(sshKeyName, sshKeyName);
    this.sg = new SecurityGroup(`${stack}-bastion`, {
      // allow incoming SSH traffic only
      ingress: [
        // Zoho analytics whitelist https://www.zoho.com/analytics/help/zohoanalytics-ip-address.html
        {
          protocol: "tcp",
          fromPort: 22,
          toPort: 22,
          cidrBlocks: ["31.186.243.98/32", "185.20.209.98/32", "185.230.212.98/32", "87.252.213.98/32", "89.36.170.98/32", "185.230.214.98/32"]
        }
      ],
      // allow the box to talk to the internet
      egress: [
        { protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"] }
      ],
      vpc: vpc,
      tags
    });
    const ec2Role = new aws.iam.Role(`${stack}-ec2-role`, {
      name: `${stack}-exec-role`,
      assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({ Service: "ec2.amazonaws.com" }),
      managedPolicyArns: ["arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"]
    });

    const subnetId: Output<string> = pulumi
      .output(vpc.publicSubnets)
      .apply((subnets) => subnets[0].id);
    this.instance = new aws.ec2.Instance(`recruit-instantly-bastion-${stack}`, {
      ami: "ami-05ff5eaef6149df49",
      instanceType: "t3.nano",
      iamInstanceProfile: new aws.iam.InstanceProfile(`${stack}-bastion-profgle`, { role: ec2Role.name }),
      metadataOptions: { httpTokens: "required", httpEndpoint: "enabled"},
      vpcSecurityGroupIds: [this.sg.id],
      keyName: bastionKeyPair.keyName,
      subnetId: subnetId,
      tags
    });
  }
}
