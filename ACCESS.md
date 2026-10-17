# Access URLs — etechapp-eks-4QAQxDD3 (us-east-2)

Repo: https://github.com/training-ux/observability-eks

## Apps

| App | URL | Login |
| --- | --- | --- |
| Ecommerce | http://a696f37dd53bc4b16b47f6a0e1542fbf-727026109.us-east-2.elb.amazonaws.com | n/a |
| Argo CD | http://ab53bb9b8ab2e413086b99815770df91-385484349.us-east-2.elb.amazonaws.com | `admin` / see secret below |
| Grafana | http://a5654a0284a734b63bc69f073402ab2e-162103515.us-east-2.elb.amazonaws.com | `admin` / `ExcelCloud2026!` |
| Prometheus | http://a7bd061120318437f8db9ab3303dc376-902617001.us-east-2.elb.amazonaws.com:9090 | n/a |

Argo CD password (cluster secret):

```bash
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo
```

## IAM role (GitHub Actions OIDC)

`arn:aws:iam::985539781710:role/github-actions-observability-eks`

Trusted for `repo:training-ux/observability-eks:*` via `token.actions.githubusercontent.com`.
Mapped in `aws-auth` as `system:masters`.

No long-lived AWS access keys are required in GitHub secrets.
