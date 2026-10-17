# observability-eks

Ecommerce cart + invoice app on Amazon EKS with **Helm**, **Argo CD**, **Prometheus**, **Grafana**, and **GitHub Actions**.

Target cluster (current default): `etechapp-eks-4QAQxDD3` in `us-east-2`  
Image registry: `985539781710.dkr.ecr.us-east-2.amazonaws.com/ecommerce`

## What you get

| Piece | Purpose |
| --- | --- |
| `app/` | Node/Express storefront: pick items, live totals, branded invoice |
| `charts/ecommerce` | Helm chart (Deployment, Service, ServiceMonitor) |
| `gitops/argocd` | App-of-apps for ecommerce + kube-prometheus-stack |
| `gitops/platform` | Prometheus / Grafana values + ecommerce dashboard |
| `.github/workflows` | Test → build/push ECR → bump Helm tag → Argo CD sync |

## App features

- Select catalog items and quantities
- Cart calculates **subtotal**, **8% tax**, and **total**
- Checkout builds an invoice with your company logo
- `/metrics` exposes Prometheus metrics (`ecommerce_*`)

### Replace the logo

Current logo: `app/public/assets/logo.jpg` (ExcelCloud).

### Invoice PDF download

- Checkout generates a real PDF with the ExcelCloud logo
- Download via the **Download PDF** button or `GET /api/invoices/:id/pdf`
- Catalog items include product images under `app/public/assets/products/`

## Repository layout

```text
observability-eks/
├── app/                         # Ecommerce application + Dockerfile
├── charts/ecommerce/            # Helm chart
├── gitops/
│   ├── argocd/                  # Argo CD Applications
│   └── platform/                # kube-prometheus-stack values
├── scripts/bootstrap.sh         # Install Argo CD + root app
└── .github/workflows/           # CI/CD + platform bootstrap
```

## One-time setup

### 1. GitHub secrets / vars

In the repo settings, add:

| Name | Type | Value |
| --- | --- | --- |
| `AWS_ACCESS_KEY_ID` | secret | IAM user/key with EKS + ECR access |
| `AWS_SECRET_ACCESS_KEY` | secret | Matching secret |
| `ARGOCD_AUTH_TOKEN` | secret | Optional, for sync wait job |
| `ARGOCD_SERVER` | variable | Optional, e.g. `axxxx.us-east-2.elb.amazonaws.com` |

### 2. Bootstrap Argo CD + platform

**Option A — GitHub Actions**

1. Open **Actions → Platform Bootstrap → Run workflow**
2. Confirm cluster `etechapp-eks-4QAQxDD3` / region `us-east-2`

**Option B — local**

```bash
export CLUSTER_NAME=etechapp-eks-4QAQxDD3
export AWS_REGION=us-east-2
./scripts/bootstrap.sh
```

This installs Argo CD and applies `gitops/argocd/root-app.yaml`, which syncs:

- `kube-prometheus-stack` (Prometheus + Grafana + Alertmanager)
- `ecommerce` Helm release

### 3. Access UIs

```bash
# Argo CD
kubectl -n argocd get svc argocd-server
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d; echo

# Grafana (default password in values file — change it)
kubectl -n monitoring get svc -l app.kubernetes.io/name=grafana

# Ecommerce storefront
kubectl -n ecommerce get svc
```

Grafana admin password default (change ASAP): see `gitops/platform/kube-prometheus-stack-values.yaml` → `grafana.adminPassword`.

## CI/CD flow

On every push to `main`:

1. **Test** the cart/invoice logic
2. **Build** the Docker image and **push** to ECR (`:gitsha` + `:latest`)
3. **Commit** the new image tag into `charts/ecommerce/values.yaml`
4. Argo CD auto-syncs the Helm release (and optionally the workflow waits if `ARGOCD_SERVER` is set)

Pull requests only run tests (no deploy).

## Local development

```bash
cd app
npm install
npm test
npm start
# open http://localhost:3000
```

## Manual Helm deploy (without Argo CD)

```bash
helm upgrade --install ecommerce ./charts/ecommerce \
  --namespace ecommerce --create-namespace
```

## Notes

- ServiceMonitor is enabled so Prometheus scrapes `/metrics` once the operator CRDs exist.
- Sync waves: platform observability first, then ecommerce (`argocd.argoproj.io/sync-wave` on apps).
- Replace the placeholder logo before demos.
