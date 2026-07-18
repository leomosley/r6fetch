mod client;
mod routes;
mod setup;

use r6_client::Platform;
use worker::{Context, Env, Request, Response, Result, event};

fn local_domain(domain: &str) -> bool {
    matches!(domain.split(':').next(), Some("localhost" | "127.0.0.1"))
}

fn decode_component(value: &str) -> String {
    worker::js_sys::decode_uri_component(value)
        .ok()
        .and_then(|decoded| decoded.as_string())
        .unwrap_or_else(|| value.to_string())
}

async fn assets(request: Request, env: &Env) -> Result<Response> {
    env.service("ASSETS")?.fetch_request(request).await
}

#[event(fetch)]
async fn fetch(request: Request, env: Env, context: Context) -> Result<Response> {
    let head = request.method() == worker::Method::Head;
    let response = match route(request, &env, &context).await {
        Ok(response) => response,
        Err(_) => routes::text_response(
            "\n  r6fetch hit an unexpected error.\n  Try again in a moment.\n\n",
            500,
        )?,
    };
    if head {
        return Ok(Response::empty()?
            .with_status(response.status_code())
            .with_headers(response.headers().clone()));
    }
    Ok(response)
}

async fn route(request: Request, env: &Env, context: &Context) -> Result<Response> {
    if !matches!(request.method(), worker::Method::Get | worker::Method::Head) {
        return assets(request, env).await;
    }
    let path = request.path();
    let domain = env.var("DOMAIN")?.to_string();
    if path == "/" {
        let curl = request
            .headers()
            .get("user-agent")?
            .unwrap_or_default()
            .to_lowercase()
            .starts_with("curl");
        return if curl {
            routes::text_response(routes::welcome(&domain), 200)
        } else {
            assets(request, env).await
        };
    }
    if path == "/setup" {
        return setup::route(&request, &domain);
    }
    let segments: Vec<&str> = path.trim_start_matches('/').split('/').collect();
    if segments.len() == 3 && segments[0] == "test" {
        if !local_domain(&domain) {
            return assets(request, env).await;
        }
        let (rank, tier) = (decode_component(segments[1]), decode_component(segments[2]));
        return routes::test_route(&rank, &tier);
    }
    if segments.len() == 2 {
        let platform_name = decode_component(segments[0]);
        let Some(platform) = Platform::parse(&platform_name) else {
            return assets(request, env).await;
        };
        let username = decode_component(segments[1]);
        return routes::stats_route(platform, &username, env, context).await;
    }
    if segments.len() == 1 {
        let platform_name = decode_component(segments[0]);
        let Some(platform) = Platform::parse(&platform_name) else {
            return assets(request, env).await;
        };
        return routes::text_response(
            format!(
                "\n  Missing username.\n  Usage: curl {domain}/{}/<username>\n\n",
                platform.as_str()
            ),
            400,
        );
    }
    assets(request, env).await
}
