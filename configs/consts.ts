export const coreControllerTaint = {
  key: "type",
  value: "controller",
  effect: "NoSchedule",
};

export const workerTaint = {
  key: "type",
  value: "worker",
  effect: "NoSchedule",
};
export const websiteTaint = {
  key: "type",
  value: "website",
  effect: "NoSchedule",
};

export const controllerAffinity = {
  nodeAffinity: {
    requiredDuringSchedulingIgnoredDuringExecution: {
      nodeSelectorTerms: [
        {
          matchExpressions: [
            {
              key: "type",
              operator: "In",
              values: ["controller"],
            },
          ],
        },
      ],
    },
  },
};

export const karpenterTaint = {
  key: "type",
  value: "karpenter",
  effect: "NoSchedule",
};
export const karpenterTaintEks = {
  key: "type",
  value: "karpenter",
  effect: "NO_SCHEDULE",
};
