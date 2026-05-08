# Rate limiting ruleset: 30 requests per minute per IP on <domain>
# Applied at the Cloudflare edge before the request reaches the Worker.
resource "cloudflare_ruleset" "rate-limit" {
  zone_id     = var.cloudflare_zone_id
  name        = "r6fetch rate limiting"
  description = "Limit requests to ${var.domain} to 30/min per IP"
  kind        = "zone"
  phase       = "http_ratelimit"

  rules {
    action = "block"
    action_parameters {
      response {
        status_code  = 429
        content_type = "text/plain"
        content      = "\n  Rate limit exceeded. Please wait before retrying.\n\n"
      }
    }
    ratelimit {
      characteristics     = ["cf.colo.id", "ip.src"]
      period              = 60
      requests_per_period = 30
      mitigation_timeout  = 60
    }
    expression  = "(http.host eq \"${var.domain}\")"
    description = "30 req/min per IP"
    enabled     = true
  }
}
