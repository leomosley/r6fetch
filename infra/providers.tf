terraform {
  # Cloudflare R2 backend (S3-compatible)
  # CI/CD passes credentials via AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY
  # Endpoint is set via AWS_ENDPOINT_URL_S3 environment variable
  backend "s3" {
    bucket = "r6fetch"
    key    = "terraform.tfstate"
    region = "auto"

    # R2 compatibility settings
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_s3_checksum            = true
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.20"
    }
  }

  required_version = ">= 1.9"
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
