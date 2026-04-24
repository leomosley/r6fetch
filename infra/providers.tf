terraform {
  cloud {
    organization = "PLACEHOLDER_TF_CLOUD_ORG"
    workspaces {
      name = "r6fetch"
    }
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
