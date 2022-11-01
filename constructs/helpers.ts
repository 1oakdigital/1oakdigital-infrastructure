import * as aws from "@pulumi/aws";
import {EfsPolicy} from "./policies";

export const managedPolicyArns: string[] = [
    "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy",
    "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
];

export function createNodeRole(name: string): aws.iam.Role {
    const role = new aws.iam.Role(name, {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
            Service: "ec2.amazonaws.com",
        }),
        inlinePolicies: [
            {name:"efs", policy:EfsPolicy}
        ]
    });

    let counter = 0;
    for (const policy of managedPolicyArns) {
        // Create RolePolicyAttachment without returning it.
         new aws.iam.RolePolicyAttachment(`${name}-policy-${counter++}`,
            {policyArn: policy, role: role},
        );
    }

    return role;
}

export function createIAMRole(name: string): aws.iam.Role {
    return new aws.iam.Role(`${name}`, {
        assumeRolePolicy: `{
            "Version": "2012-10-17",
            "Statement":[
              {
                "Sid": "",
                "Effect": "Allow",
                "Principal": {
                  "AWS": "arn:aws:iam::707053725174:root"
                },
                "Action": "sts:AssumeRole"
              }
            ]
           }
        `,
        tags: {
            "clusterAccess": `${name}-usr`,
        },
    });
}

export function splitIntoChunk(arr:any[], chunk:number) {
    let tempArray = []
    for (let i=0; i < arr.length; i += chunk) {
        tempArray.push(arr.slice(i, i + chunk))
    }
    return tempArray

}