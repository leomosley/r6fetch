# KV namespace for response caching
resource "cloudflare_workers_kv_namespace" "cache" {
  account_id = var.cloudflare_account_id
  title      = "r6fetch-cache"
}

# Worker script is deployed via `wrangler deploy` in CI — Terraform manages
# the surrounding infrastructure (KV bindings, secrets, routes) rather than
# the script bundle itself to keep the deployment boundary clean.

# API key stored as a Worker secret (never appears in state in plaintext
# because Cloudflare secrets are write-only from the API perspective).
resource "cloudflare_worker_secret" "stats_cc_api_key" {
  account_id  = var.cloudflare_account_id
  script_name = "r6fetch-api"
  name        = "STATS_CC_API_KEY"
  secret_text = var.stats_cc_api_key
}

# Custom domain route: <domain> → r6fetch-api worker
resource "cloudflare_worker_domain" "r6" {
  account_id = var.cloudflare_account_id
  hostname   = var.domain
  service    = "r6fetch-api"
  zone_id    = var.cloudflare_zone_id
}
