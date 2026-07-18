use crate::{R6Error, RankInfo};

pub const RANK_NAMES: [&str; 41] = [
    "Unranked",
    "Copper V",
    "Copper IV",
    "Copper III",
    "Copper II",
    "Copper I",
    "Bronze V",
    "Bronze IV",
    "Bronze III",
    "Bronze II",
    "Bronze I",
    "Silver V",
    "Silver IV",
    "Silver III",
    "Silver II",
    "Silver I",
    "Gold V",
    "Gold IV",
    "Gold III",
    "Gold II",
    "Gold I",
    "Platinum V",
    "Platinum IV",
    "Platinum III",
    "Platinum II",
    "Platinum I",
    "Emerald V",
    "Emerald IV",
    "Emerald III",
    "Emerald II",
    "Emerald I",
    "Diamond V",
    "Diamond IV",
    "Diamond III",
    "Diamond II",
    "Diamond I",
    "Champion V",
    "Champion IV",
    "Champion III",
    "Champion II",
    "Champion I",
];

fn js_round(value: f64) -> f64 {
    if !value.is_finite() || value.fract() == 0.0 {
        return value;
    }
    let floor = value.floor();
    if value - floor < 0.5 {
        floor
    } else {
        floor + 1.0
    }
}

fn slug_tier(slug: &str) -> Option<usize> {
    if slug == "unranked" {
        return Some(0);
    }
    let (family, division) = slug.rsplit_once('-')?;
    let base = match family {
        "copper" => 1,
        "bronze" => 6,
        "silver" => 11,
        "gold" => 16,
        "platinum" => 21,
        "emerald" => 26,
        "diamond" => 31,
        "champion" => 36,
        _ => return None,
    };
    let offset = match division {
        "v" => 0,
        "iv" => 1,
        "iii" => 2,
        "ii" => 3,
        "i" => 4,
        _ => return None,
    };
    Some(base + offset)
}

pub fn slug_to_rank_info(
    slug: Option<&str>,
    rp: f64,
    champ_number: Option<f64>,
) -> Result<RankInfo, R6Error> {
    let Some(slug) = slug.filter(|value| !value.is_empty()) else {
        return Ok(RankInfo {
            name: "Unranked".into(),
            tier: 0.0,
            rp: 0.0,
            champ_number: None,
        });
    };
    let lower = slug.to_lowercase();
    let normalized = lower.strip_prefix("v7-").unwrap_or(&lower);
    if normalized == "champion" {
        return Ok(RankInfo {
            name: "Champion".into(),
            tier: 40.0,
            rp,
            champ_number,
        });
    }
    let Some(tier) = slug_tier(normalized) else {
        return Err(R6Error::Api(format!(
            "Unsupported rank slug received from API: {slug}"
        )));
    };
    Ok(RankInfo {
        name: RANK_NAMES[tier].into(),
        tier: tier as f64,
        rp,
        champ_number,
    })
}

pub fn tier_to_rank_info(tier: f64, rp: f64) -> RankInfo {
    let tier = if tier.is_finite() {
        js_round(tier).clamp(0.0, 40.0)
    } else {
        0.0
    };
    RankInfo {
        name: RANK_NAMES[tier as usize].into(),
        tier,
        rp: if rp.is_finite() && rp >= 0.0 { rp } else { 0.0 },
        champ_number: None,
    }
}

pub fn rank_name_to_tier(name: &str) -> usize {
    RANK_NAMES
        .iter()
        .position(|rank| rank.eq_ignore_ascii_case(name))
        .unwrap_or(0)
}

pub fn round_js(value: f64) -> f64 {
    js_round(value)
}
