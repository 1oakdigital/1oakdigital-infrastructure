import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import {Output} from "@pulumi/pulumi/output";
import * as pulumi from "@pulumi/pulumi";

export class BastionHost {
    /**  Bastion - a single EC2 instance that we can ssh into, providing a view into the rest of the network. */

    readonly sg: aws.ec2.SecurityGroup;
    readonly instance?: aws.ec2.Instance;

    constructor(
        stack: string,
        vpc: awsx.ec2.Vpc,
        sshKeyName: string,
        tags?: { [key: string]: string }
    ) {
        const bastionKeyPair = aws.ec2.KeyPair.get(sshKeyName, sshKeyName);
        this.sg = new aws.ec2.SecurityGroup(`${stack}-bastion`, {
            // allow incoming SSH traffic only
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: 22,
                    toPort: 22,
                    cidrBlocks: ["0.0.0.0/0"]
                }
            ],
            // allow the box to talk to the internet
            egress: [
                {protocol: "-1", fromPort: 0, toPort: 0, cidrBlocks: ["0.0.0.0/0"]}
            ],
            vpcId: vpc.vpcId,
            tags
        });
        const ec2Role = new aws.iam.Role(`${stack}-ec2-role`, {
            name: `${stack}-execution-role`,
            assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({Service: "ec2.amazonaws.com"}),
            managedPolicyArns: ["arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"]
        });

        const subnetId: Output<string> = pulumi
            .output(vpc.publicSubnetIds)
            .apply((subnets) => subnets[0]);
        this.instance = new aws.ec2.Instance(`bastion-${stack}`, {
            ami: "ami-06672d07f62285d1d",
            instanceType: "t3.nano",
            iamInstanceProfile: new aws.iam.InstanceProfile(`${stack}-bastion-profile`, {role: ec2Role.name}),
            metadataOptions: {httpTokens: "required", httpEndpoint: "enabled"},
            vpcSecurityGroupIds: [this.sg.id],
            keyName: bastionKeyPair.keyName,
            subnetId: subnetId,
            tags
        });
    }
}
