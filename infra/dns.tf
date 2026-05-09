# Disable Cloudflare's automatic HTTPS redirect so plain `curl r6fetch.cc/...`
# (HTTP on port 80) is served without a 308 redirect.
resource "cloudflare_zone_settings_override" "r6fetch-cc" {
  zone_id = var.cloudflare_zone_id

  settings {
    always_use_https = "off"
    ssl              = "full"
    min_tls_version  = "1.2"
  }
}

# DNS record is not needed - cloudflare_worker_domain in workers.tf
# handles routing r6fetch.cc to the Worker automatically.
