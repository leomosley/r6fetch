variable "cloudflare_api_token" {
  description = "Cloudflare API token with Workers, KV, DNS, and Zone Settings permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare account ID"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for mosly.dev"
  type        = string
}

variable "r6data_api_key" {
  description = "API key for r6data.eu"
  type        = string
  sensitive   = true
}
