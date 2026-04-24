# Disable Cloudflare's automatic HTTPS redirect so plain `curl r6.mosly.dev/...`
# (HTTP on port 80) is served without a 308 redirect.
resource "cloudflare_zone_settings_override" "mosly-dev" {
  zone_id = var.cloudflare_zone_id

  settings {
    always_use_https = "off"
    ssl              = "full"
    min_tls_version  = "1.2"
  }
}

# CNAME pointing r6.mosly.dev to the Workers route
# Cloudflare Workers routes are attached separately; this record makes the
# hostname resolve through Cloudflare's proxy (orange-cloud).
resource "cloudflare_record" "r6" {
  zone_id = var.cloudflare_zone_id
  name    = "r6"
  type    = "CNAME"
  content = "r6fetch-api.workers.dev"
  proxied = true # Must be proxied for Workers routes to apply
}
