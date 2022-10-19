
        // const provider = new Provider(`${stack}-provider-aws-us-east-1`, {
        //     region: "us-east-1"
        // });
        // this.cloudfrontCertificate = new aws.acm.Certificate(
        //     `${stack}-cloudfront-certificate`,
        //     {
        //         domainName: this.domain,
        //         subjectAlternativeNames: [`*.${this.domain}`],
        //         validationMethod: "DNS",
        //         tags
        //     },
        //     {provider, retainOnDelete: true}
        // );

        //
        //       // Administrator AWS IAM clusterAdminRole with full access to all AWS resources
        //       const clusterAdminRole = createIAMRole(`${stack}-clusterAdminRole`);
        //
        //       // Administer Automation role for use in pipelines, e.g. gitlab CI, Teamcity, etc.
        //       const AutomationRole = createIAMRole(`${stack}-AutomationRole`);
        //
        //       // Administer Prod role for use in Prod environment
        //       const EnvProdRole = createIAMRole(`${stack}-EnvProdRole`);
        //
        //

               // new aws.eks.Addon(`${stack}-coredns-addon`, {
        //     clusterName: clusterName,
        //     addonName: "coredns",
        //     resolveConflicts: "OVERWRITE",
        //     addonVersion: "v1.8.7-eksbuild.3"
        // });

         //
        //
        //       // Grant cluster admin access to all admins with k8s ClusterRole and ClusterRoleBinding
        //       new k8s.rbac.v1.ClusterRole("clusterAdminRole", {
        //           metadata: {
        //               name: "clusterAdminRole",
        //           },
        //           rules: [{
        //               apiGroups: ["*"],
        //               resources: ["*"],
        //               verbs: ["*"],
        //           }]
        //       }, {provider: this.cluster.provider});
        //
        //       new k8s.rbac.v1.ClusterRoleBinding("cluster-admin-binding", {
        //           metadata: {
        //               name: "cluster-admin-binding",
        //           },
        //           subjects: [{
        //               kind: "User",
        //               name: "pulumi:admin-usr",
        //           }],
        //           roleRef: {
        //               kind: "ClusterRole",
        //               name: "clusterAdminRole",
        //               apiGroup: "rbac.authorization.k8s.io",
        //           },
        //       }, {provider: this.cluster.provider});
        //
        //       // User2 called automation-usr for users that have permissions to all k8s resources in the namespace automation
        //       new k8s.rbac.v1.Role("AutomationRole", {
        //           metadata: {
        //               name: "AutomationRole",
        //               namespace: automationNamespace,
        //           },
        //           rules: [{
        //               apiGroups: ["*"],
        //               resources: ["*"],
        //               verbs: ["*"],
        //           }]
        //       }, {provider: this.cluster.provider});
        //
        //       new k8s.rbac.v1.RoleBinding("automation-binding", {
        //           metadata: {
        //               name: "automation-binding",
        //               namespace: "automation",
        //           },
        //           subjects: [{
        //               kind: "User",
        //               name: "pulumi:automation-usr",
        //               apiGroup: "rbac.authorization.k8s.io",
        //           }],
        //           roleRef: {
        //               kind: "Role",
        //               name: "AutomationRole",
        //               apiGroup: "rbac.authorization.k8s.io",
        //           },
        //       }, {provider: this.cluster.provider});
        //
        //       // User3 called prod-usr for users that have read access to all k8s resources in the namespace env-prod
        //       new k8s.rbac.v1.Role("EnvProdRole", {
        //           metadata: {
        //               name: "EnvProdRole",
        //               namespace: "prod",
        //           },
        //           rules: [{
        //               apiGroups: ["*"],
        //               resources: ["*"],
        //               verbs: ["get", "watch", "list"],
        //           }],
        //       }, {provider: this.cluster.provider});
        //
        //       new k8s.rbac.v1.RoleBinding("env-prod-binding", {
        //           metadata: {
        //               name: "env-prod-binding",
        //               namespace: "prod",
        //           },
        //           subjects: [{
        //               kind: "User",
        //               name: "pulumi:prod-usr",
        //               apiGroup: "rbac.authorization.k8s.io",
        //           }],
        //           roleRef: {
        //               kind: "Role",
        //               name: "EnvProdRole",
        //               apiGroup: "rbac.authorization.k8s.io",
        //           },
        //       }, {provider: this.cluster.provider});
        //
        //



