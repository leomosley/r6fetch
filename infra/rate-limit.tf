# Rate limiting ruleset: 5 requests per 10 seconds per IP on the stats endpoints.
# Applied at the Cloudflare edge before the request reaches the Worker.
#
# Scoped to the /<platform>/<username> stats paths only. This protects the
# upstream stats.cc API from abuse without throttling the website, docs, setup
# script, or static assets served from the same host.
#
# Requires "Zone > Zone WAF > Edit" permission on the API token
# Note: Free plan only supports 10-second periods
resource "cloudflare_ruleset" "rate-limit" {
  zone_id     = var.cloudflare_zone_id
  name        = "r6fetch rate limiting"
  description = "Limit requests to ${var.domain} to 5/10s per IP"
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
      period              = 10
      requests_per_period = 5
      mitigation_timeout  = 10
    }
    expression  = "(http.host eq \"${var.domain}\" and (starts_with(http.request.uri.path, \"/pc/\") or starts_with(http.request.uri.path, \"/ps/\") or starts_with(http.request.uri.path, \"/xbox/\")))"
    description = "5 req/10s per IP on stats endpoints"
    enabled     = true
  }
}
