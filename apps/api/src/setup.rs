use worker::{Headers, Request, Response, Result};

const SH_TEMPLATE: &str = include_str!("setup.sh");
const PS_TEMPLATE: &str = include_str!("setup.ps1");

fn valid_domain(domain: &str) -> bool {
    if let Some(port) = domain
        .strip_prefix("localhost:")
        .or_else(|| domain.strip_prefix("127.0.0.1:"))
    {
        return !port.is_empty() && port.chars().all(|character| character.is_ascii_digit());
    }
    if matches!(domain, "localhost" | "127.0.0.1") {
        return true;
    }
    let Some((_, suffix)) = domain.rsplit_once('.') else {
        return false;
    };
    suffix.len() >= 2
        && suffix
            .chars()
            .all(|character| character.is_ascii_alphabetic())
        && domain.split('.').all(|label| {
            !label.is_empty()
                && !label.starts_with('-')
                && !label.ends_with('-')
                && label
                    .chars()
                    .all(|character| character.is_ascii_alphanumeric() || character == '-')
        })
}

pub fn route(request: &Request, domain: &str) -> Result<Response> {
    if !valid_domain(domain) {
        return crate::routes::text_response(
            "\n  Setup is temporarily unavailable.\n  Try again in a moment.\n\n",
            503,
        );
    }
    let protocol = if domain.starts_with("localhost") || domain.starts_with("127.0.0.1") {
        "http"
    } else {
        "https"
    };
    let origin = format!("{protocol}://{domain}");
    let powershell = request
        .headers()
        .get("user-agent")?
        .unwrap_or_default()
        .to_lowercase()
        .contains("powershell");
    let body =
        if powershell { PS_TEMPLATE } else { SH_TEMPLATE }.replace("__R6FETCH_ORIGIN__", &origin);
    let headers = Headers::new();
    headers.set("Content-Type", "text/plain; charset=utf-8")?;
    headers.set("Vary", "User-Agent")?;
    Ok(Response::ok(body)?.with_headers(headers))
}
