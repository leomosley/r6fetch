# R2 bucket for OpenTofu state storage
# NOTE: This creates a chicken-and-egg problem - the bucket must exist before
# OpenTofu can store state in it. For initial bootstrap:
#   1. Create the bucket manually in Cloudflare dashboard (one-time)
#   2. Run `tofu import cloudflare_r2_bucket.tfstate r6fetch-tfstate`
#   3. Future runs will manage it normally

resource "cloudflare_r2_bucket" "tfstate" {
  account_id = var.cloudflare_account_id
  name       = "r6fetch-tfstate"
  location   = "WNAM" # Western North America
}
