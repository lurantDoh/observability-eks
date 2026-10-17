#!/usr/bin/env bash
set -euo pipefail

# Bootstrap Argo CD on the current kube-context, then apply the root app-of-apps.
# Prerequisites: kubectl, helm, aws cli, cluster admin access.

CLUSTER_NAME="${CLUSTER_NAME:-etechapp-eks-4QAQxDD3}"
AWS_REGION="${AWS_REGION:-us-east-2}"
REPO_URL="${REPO_URL:-https://github.com/training-ux/observability-eks.git}"

echo "==> Updating kubeconfig for ${CLUSTER_NAME} (${AWS_REGION})"
aws eks update-kubeconfig --name "${CLUSTER_NAME}" --region "${AWS_REGION}"

echo "==> Creating argocd namespace"
kubectl create namespace argocd --dry-run=client -o yaml | kubectl apply -f -

echo "==> Installing Argo CD via Helm"
helm repo add argo https://argoproj.github.io/argo-helm
helm repo update
helm upgrade --install argocd argo/argo-cd \
  --namespace argocd \
  --set server.service.type=LoadBalancer \
  --set configs.params."server\.insecure"=true \
  --wait

echo "==> Waiting for Argo CD server"
kubectl -n argocd rollout status deploy/argocd-server --timeout=300s

echo "==> Applying root Application (repo: ${REPO_URL})"
# Allow editing the repo URL without committing secrets into bootstrap
sed "s|https://github.com/training-ux/observability-eks.git|${REPO_URL}|g" \
  gitops/argocd/root-app.yaml | kubectl apply -f -

echo
echo "Bootstrap complete."
echo "Argo CD initial admin password:"
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
echo
echo
echo "Argo CD URL (wait for EXTERNAL-IP):"
kubectl -n argocd get svc argocd-server
echo "Grafana will be available after kube-prometheus-stack syncs (namespace monitoring)."
