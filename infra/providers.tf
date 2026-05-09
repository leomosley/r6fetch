terraform {
  # Cloudflare R2 backend (S3-compatible)
  # Initialize with: tofu init -backend-config=backend.conf
  # CI/CD passes credentials via AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY
  backend "s3" {
    bucket = "r6fetch-tfstate"
    key    = "terraform.tfstate"
    region = "auto"

    # R2 doesn't support these features
    skip_credentials_validation = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_s3_checksum            = true
  }

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }

  required_version = ">= 1.9"
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
