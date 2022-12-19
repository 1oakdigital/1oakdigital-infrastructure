#!/bin/bash

crd2pulumi --nodejsPath ./crds/grafana/agent https://raw.githubusercontent.com/grafana/agent/main/production/operator/crds/monitoring.grafana.com_grafanaagents.yaml --force
crd2pulumi --nodejsPath ./crds/grafana/serviceMonitors https://raw.githubusercontent.com/grafana/agent/main/production/operator/crds/monitoring.coreos.com_servicemonitors.yaml --force
crd2pulumi --nodejsPath ./crds/grafana https://raw.githubusercontent.com/grafana/agent/main/production/operator/crds/monitoring.coreos.com_servicemonitors.yaml --force^C
crd2pulumi --nodejsPath ./crds/grafana/podLogs https://raw.githubusercontent.com/grafana/agent/main/production/operator/crds/monitoring.grafana.com_podlogs.yaml --force
crd2pulumi --nodejsPath ./crds/grafana/metricsInstance https://raw.githubusercontent.com/grafana/agent/main/production/operator/crds/monitoring.grafana.com_metricsinstances.yaml --force
crd2pulumi --nodejsPath ./crds/grafana/logsInstance https://raw.githubusercontent.com/grafana/agent/main/production/operator/crds/monitoring.grafana.com_logsinstances.yaml --force
crd2pulumi --nodejsPath ./crds/grafana/integrations https://raw.githubusercontent.com/grafana/agent/main/production/operator/crds/monitoring.grafana.com_integrations.yaml --force
# Flagger
crd2pulumi --nodejsPath ./crds/flagger https://raw.githubusercontent.com/fluxcd/flagger/main/artifacts/flagger/crd.yaml
# Github runners
crd2pulumi --nodejsPath ./crds/github/deployment https://raw.githubusercontent.com/actions-runner-controller/actions-runner-controller/master/charts/actions-runner-controller/crds/actions.summerwind.dev_runnerdeployments.yaml
crd2pulumi --nodejsPath ./crds/github/horizontalrunnerautoscalers  https://raw.githubusercontent.com/actions-runner-controller/actions-runner-controller/master/charts/actions-runner-controller/crds/actions.summerwind.dev_horizontalrunnerautoscalers.yaml
# Karpenter
crd2pulumi --nodejsPath ./crds/karpenter/awsnodetemplates https://raw.githubusercontent.com/aws/karpenter/main/pkg/apis/crds/karpenter.k8s.aws_awsnodetemplates.yaml
