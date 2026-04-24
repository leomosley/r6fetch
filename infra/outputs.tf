output "kv_namespace_id" {
  description = "Cloudflare KV namespace ID — paste into wrangler.toml"
  value       = cloudflare_workers_kv_namespace.cache.id
}

output "worker_url" {
  description = "Worker route URL"
  value       = "https://r6.mosly.dev"
}
