import * as k8s from "@pulumi/kubernetes";
import {
  controllerAffinity,
  coreControllerTaint,
  workerTaint,
} from "../../configs/consts";
import { RunnerDeployment } from "../../crds/github/deployment/actions/v1alpha1/runnerDeployment";
import { HorizontalRunnerAutoscaler } from "../../crds/github/horizontalrunnerautoscalers/actions/v1alpha1/horizontalRunnerAutoscaler";
import { config } from "../../index";

export class GithubRunner {
  constructor() {
    const certManager = new k8s.helm.v3.Release(
      "cert-manager",
      {
        chart: "cert-manager",
        version: "1.10.1",
        values: {
          affinity: controllerAffinity,
          tolerations: [coreControllerTaint],
          installCRDs: true,
        },
        cleanupOnFail: true,
        repositoryOpts: {
          repo: "https://charts.jetstack.io",
        },
      },
      { deleteBeforeReplace: true }
    );
    const runnerController = new k8s.helm.v3.Release(
      "actions-runner-controller",
      {
        chart: "actions-runner-controller",
        version: "0.21.1",
        values: {
          authSecret: {
            create: true,
            github_token: config.requireSecret("githubToken"),
          },
        },
        cleanupOnFail: true,
        repositoryOpts: {
          repo: "https://actions-runner-controller.github.io/actions-runner-controller",
        },
      },
      { dependsOn: [certManager], deleteBeforeReplace: true }
    );
    const runnerDeployment = new RunnerDeployment(
      "runner",
      {
        metadata: {
          name: "runner",
          namespace: "automation",
        },
        spec: {
          replicas: 1,
          template: {
            spec: {
              repository: "1oakdigital/dating_site",
              tolerations: [workerTaint],
              resources: {
                requests: {
                  cpu: "256m",
                  memory: "512Mi",
                },
                limits: {
                  cpu: "1",
                  memory: "2048Mi",
                },
              },
              affinity: {
                nodeAffinity: {
                  requiredDuringSchedulingIgnoredDuringExecution: {
                    nodeSelectorTerms: [
                      {
                        matchExpressions: [
                          {
                            key: "type",
                            operator: "In",
                            values: ["worker"],
                          },
                        ],
                      },
                    ],
                  },
                },
              },
            },
          },
        },
      },
      { dependsOn: [runnerController] }
    );
    new HorizontalRunnerAutoscaler(
      "runner-autoscaler",
      {
        metadata: {
          name: "runner",
          namespace: "automation",
        },
        spec: {
          // @ts-ignore
          scaleTargetRef: { name: runnerDeployment.metadata.name },
          scaleDownDelaySecondsAfterScaleOut: 500,
          minReplicas: 1,
          maxReplicas: 5,
          metrics: [
            {
              type: "TotalNumberOfQueuedAndInProgressWorkflowRuns",
              repositoryNames: ["1oakdigital/dating_site"],
            },
          ],
        },
      },
      { dependsOn: [runnerController] }
    );
  }
}
