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

# A record pointing r6fetch.cc to Cloudflare's Workers (root domain)
# Using @ for the root domain, proxied through Cloudflare.
resource "cloudflare_record" "root" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  type    = "A"
  content = "192.0.2.1" # Dummy IP - traffic is proxied to Workers
  proxied = true
}
