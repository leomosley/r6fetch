# R2 bucket for OpenTofu state storage
# NOTE: This bucket was created manually in Cloudflare dashboard.
# To import it into state: tofu import cloudflare_r2_bucket.tfstate r6fetch-account-token

resource "cloudflare_r2_bucket" "tfstate" {
  account_id = var.cloudflare_account_id
  name       = "r6fetch-account-token"
  location   = "WNAM" # Western North America
}
