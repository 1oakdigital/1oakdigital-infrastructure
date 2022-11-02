export const coreControllerTaint = {
  key: "type",
  value: "controller",
  effect: "NoSchedule",
};
export const coreControllerTaintEks = {
  key: "type",
  value: "controller",
  effect: "NO_SCHEDULE",
};

export const spotTaint = {
  key: "compute-type",
  value: "spot",
  effect: "NO_SCHEDULE",
};
export const workerTaint = {
  key: "type",
  value: "worker",
  effect: "NO_SCHEDULE",
};
export const websiteTaint = {
  key: "type",
  value: "website",
  effect: "NO_SCHEDULE",
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
