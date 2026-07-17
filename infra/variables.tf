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
  description = "Cloudflare zone ID for r6fetch.cc"
  type        = string
}

variable "stats_cc_api_key" {
  description = "API key for r6.stats.cc"
  type        = string
  sensitive   = true
}

variable "r6data_api_key" {
  description = "Legacy API key retained for the provider migration rollout"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Public domain for the r6fetch API"
  type        = string
  default     = "r6fetch.cc"
}
