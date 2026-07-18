use r6_client::{Platform, PlayerProfile, R6Error, RankInfo, tier_to_rank_info};
use renderer::{render, sanitize_terminal_text};
use worker::{Context, Env, Headers, Response, Result};

use crate::client;

const DEFAULT_TTL: u64 = 300;

pub fn welcome(domain: &str) -> String {
    let protocol = if matches!(domain.split(':').next(), Some("localhost" | "127.0.0.1")) {
        "http"
    } else {
        "https"
    };
    let origin = format!("{protocol}://{domain}");
    format!(
        "\n  r6fetch — Rainbow Six Siege stats in your terminal\n  ───────────────────────────────────────────────────\n\n  Usage:\n    curl {origin}/<platform>/<username>\n\n  Platforms:\n    pc    — Ubisoft Connect\n    ps    — PlayStation Network\n    xbox  — Xbox Live\n\n  Examples:\n    curl {origin}/pc/GamersClub\n    curl {origin}/ps/Pengu\n    curl {origin}/xbox/Beaulo\n\n  First time? Set up a default player:\n    curl -fsSL {origin}/setup | sh\n\n  Web: https://{domain}\n\n"
    )
}

fn text_with_headers(body: String, status: u16, headers: &[(&str, String)]) -> Result<Response> {
    let response_headers = Headers::new();
    response_headers.set("Content-Type", "text/plain; charset=UTF-8")?;
    for (key, value) in headers {
        response_headers.set(key, value)?;
    }
    Ok(Response::ok(body)?
        .with_status(status)
        .with_headers(response_headers))
}

pub fn text_response(body: impl Into<String>, status: u16) -> Result<Response> {
    text_with_headers(body.into(), status, &[])
}

fn cache_config(env: &Env) -> Option<(bool, u64)> {
    let enabled = env.var("CACHE_ENABLED").ok()?.to_string();
    if enabled != "true" && enabled != "false" {
        return None;
    }
    let raw = env.var("CACHE_TTL_SECONDS").ok()?.to_string();
    let ttl = if raw.is_empty() {
        DEFAULT_TTL
    } else {
        raw.parse::<f64>()
            .ok()
            .filter(|number| number.fract() == 0.0)
            .map(|number| number as u64)?
    };
    (60..=86_400)
        .contains(&ttl)
        .then_some((enabled == "true", ttl))
}

fn valid_username(value: &str) -> bool {
    !value.trim().is_empty()
        && value.encode_utf16().count() <= 100
        && !value
            .chars()
            .any(|character| matches!(character as u32, 0..=0x1f | 0x7f..=0x9f))
}

fn sanitize_profile(mut profile: PlayerProfile) -> PlayerProfile {
    profile.username = sanitize_terminal_text(&profile.username);
    profile.current_rank.name = sanitize_terminal_text(&profile.current_rank.name);
    profile.peak_rank_season.name = sanitize_terminal_text(&profile.peak_rank_season.name);
    profile.peak_rank_all_time.name = sanitize_terminal_text(&profile.peak_rank_all_time.name);
    profile.top_operator = profile
        .top_operator
        .map(|value| sanitize_terminal_text(&value));
    profile
}

pub async fn stats_route(
    platform: Platform,
    username: &str,
    env: &Env,
    context: &Context,
) -> Result<Response> {
    if !valid_username(username) {
        return text_response(
            "\n  Invalid username.\n  Enter a username between 1 and 100 characters.\n\n",
            400,
        );
    }
    let Some((cache_enabled, ttl)) = cache_config(env) else {
        return text_response(
            "\n  r6fetch is temporarily unavailable.\n  Try again in a moment.\n\n",
            503,
        );
    };
    let api_key = env
        .secret("STATS_CC_API_KEY")
        .ok()
        .map(|secret| secret.to_string())
        .filter(|value| !value.trim().is_empty());
    let Some(api_key) = api_key else {
        return text_response(
            "\n  r6fetch is temporarily unavailable.\n  Try again in a moment.\n\n",
            503,
        );
    };
    let cache_key = format!("stats:v2:{}:{}", platform.as_str(), username.to_lowercase());
    if cache_enabled {
        if let Ok(Some(value)) = env.kv("CACHE")?.get(&cache_key).text().await {
            if !value.is_empty() {
                return text_with_headers(
                    value,
                    200,
                    &[
                        ("X-Cache", "HIT".into()),
                        ("Cache-Control", format!("public, max-age={ttl}")),
                    ],
                );
            }
        }
    }
    let profile = match client::profile(platform, username, &api_key).await {
        Ok(profile) => profile,
        Err(R6Error::PlayerNotFound { .. }) => {
            return text_response(
                format!(
                    "\n  Player not found: {username} on {}\n\n  Check the username and platform are correct.\n  Usage: curl {}/<platform>/<username>\n\n",
                    platform.as_str(),
                    env.var("DOMAIN")?.to_string()
                ),
                404,
            );
        }
        Err(R6Error::Api(_) | R6Error::Decode(_) | R6Error::InvalidInput(_)) => {
            return text_response(
                "\n  Failed to fetch stats — the R6 API may be temporarily unavailable.\n  Try again in a moment.\n\n",
                503,
            );
        }
        Err(error) => return Err(worker::Error::RustError(error.to_string())),
    };
    let output = render(&sanitize_profile(profile));
    if cache_enabled {
        let cache = env.kv("CACHE")?;
        let key = cache_key.clone();
        let value = output.clone();
        context.wait_until(async move {
            if let Ok(builder) = cache.put(&key, value) {
                let _ = builder.expiration_ttl(ttl).execute().await;
            }
        });
    }
    text_with_headers(
        output,
        200,
        &[
            (
                "X-Cache",
                if cache_enabled { "MISS" } else { "DISABLED" }.into(),
            ),
            (
                "Cache-Control",
                if cache_enabled {
                    format!("public, max-age={ttl}")
                } else {
                    "no-store".into()
                },
            ),
        ],
    )
}

pub fn test_route(rank: &str, tier: &str) -> Result<Response> {
    let rank = rank.to_lowercase();
    let tier = tier.to_lowercase();
    let base = match rank.as_str() {
        "unranked" => 0,
        "copper" => 1,
        "bronze" => 6,
        "silver" => 11,
        "gold" => 16,
        "platinum" => 21,
        "emerald" => 26,
        "diamond" => 31,
        "champion" => 36,
        _ => {
            return text_response(
                format!(
                    "\n  Unknown rank: {rank}\n  Valid ranks: unranked, copper, bronze, silver, gold, platinum, emerald, diamond, champion\n\n"
                ),
                400,
            );
        }
    };
    let roman = match tier.as_str() {
        "v" => Some(0),
        "iv" => Some(1),
        "iii" => Some(2),
        "ii" => Some(3),
        "i" => Some(4),
        _ => None,
    };
    let (tier_index, champ_number) = if rank == "unranked" {
        (0, None)
    } else if rank == "champion" {
        if let Some(offset) = roman {
            (base + offset, None)
        } else if tier.len() <= 5
            && tier.chars().all(|c| c.is_ascii_digit())
            && tier
                .parse::<u32>()
                .is_ok_and(|number| (1..=99_999).contains(&number))
        {
            (40, tier.parse::<f64>().ok())
        } else {
            return text_response(
                format!(
                    "\n  Invalid champion tier: {tier}\n  Use i, ii, iii, iv, v or a number 1-99999\n\n"
                ),
                400,
            );
        }
    } else if let Some(offset) = roman {
        (base + offset, None)
    } else {
        return text_response(
            format!("\n  Invalid tier: {tier}\n  Use i, ii, iii, iv, or v\n\n"),
            400,
        );
    };
    let mut current = tier_to_rank_info(tier_index as f64, (4000 + tier_index * 50) as f64);
    current.champ_number = champ_number;
    let mut peak = tier_to_rank_info(tier_index as f64, (4100 + tier_index * 50) as f64);
    peak.champ_number = champ_number;
    let profile = PlayerProfile {
        username: "TestPlayer".into(),
        platform: Platform::Pc,
        level: 250.0,
        current_rank: current,
        peak_rank_season: peak,
        peak_rank_all_time: RankInfo {
            name: "Champion I".into(),
            tier: 40.0,
            rp: 5200.0,
            champ_number: Some(420.0),
        },
        leaderboard_position: (tier_index >= 31 || champ_number.is_some())
            .then_some(champ_number.unwrap_or(1234.0).min(10_000.0)),
        kd: 1.25,
        win_rate: 52.0,
        kills: 12345.0,
        deaths: 9876.0,
        wins: 500.0,
        losses: 460.0,
        headshot_percent: Some(48.5),
        top_operator: Some("Sledge".into()),
    };
    text_response(render(&profile), 200)
}
