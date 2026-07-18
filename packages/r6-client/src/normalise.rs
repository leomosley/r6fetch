use std::collections::BTreeMap;

use serde_json::{Map, Value};

use crate::ranks::round_js;
use crate::types::{OperatorStats, SeasonModeRecord, SeasonRankRecord};
use crate::{Platform, PlayerProfile, ProfileResponse, R6Error, RankInfo, slug_to_rank_info};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ConfigResponse {
    pub current_season: String,
    pub ranked_bomb_mode: String,
}

fn object(value: &Value) -> Option<&Map<String, Value>> {
    value.as_object()
}

fn finite_number(value: Option<&Value>) -> Option<f64> {
    value?.as_f64().filter(|number| number.is_finite())
}

fn non_negative_number(value: Option<&Value>) -> Option<f64> {
    finite_number(value).filter(|number| *number >= 0.0)
}

fn non_negative_integer(value: Option<&Value>) -> Option<f64> {
    non_negative_number(value).filter(|number| number.fract() == 0.0)
}

fn positive_integer(value: Option<&Value>) -> Option<f64> {
    non_negative_integer(value).filter(|number| *number > 0.0)
}

fn required_nonblank<'a>(record: &'a Map<String, Value>, key: &str) -> Option<&'a str> {
    record
        .get(key)?
        .as_str()
        .filter(|value| !value.trim().is_empty())
}

pub fn parse_config_response(value: &Value) -> Result<ConfigResponse, R6Error> {
    let slugs = object(value)
        .and_then(|root| root.get("constants"))
        .and_then(object)
        .and_then(|constants| constants.get("slugs"))
        .and_then(object)
        .ok_or_else(|| R6Error::Decode("Config response is missing required slugs".into()))?;
    let current_season = required_nonblank(slugs, "current_season")
        .ok_or_else(|| R6Error::Decode("Config response is missing required slugs".into()))?;
    let ranked_bomb_mode = required_nonblank(slugs, "ranked_bomb_mode")
        .ok_or_else(|| R6Error::Decode("Config response is missing required slugs".into()))?;
    Ok(ConfigResponse {
        current_season: current_season.into(),
        ranked_bomb_mode: ranked_bomb_mode.into(),
    })
}

fn parse_rank_record(value: &Value) -> Option<SeasonRankRecord> {
    let record = object(value)?;
    let _season = record
        .get("season")?
        .as_str()
        .filter(|value| !value.is_empty())?;
    let rank = record
        .get("rank")?
        .as_str()
        .filter(|value| !value.is_empty())?;
    let max_rank = record
        .get("max_rank")?
        .as_str()
        .filter(|value| !value.is_empty())?;
    Some(SeasonRankRecord {
        rank: rank.into(),
        max_rank: max_rank.into(),
        rank_points: non_negative_number(record.get("rank_points"))?,
        max_rank_points: non_negative_number(record.get("max_rank_points"))?,
        rank_position: positive_integer(record.get("rank_position")),
        max_rank_position: positive_integer(record.get("max_rank_position")),
    })
}

fn parse_mode_record(value: &Value) -> Option<SeasonModeRecord> {
    let record = object(value)?;
    record.get("season")?.as_str()?;
    record.get("mode")?.as_str()?;
    Some(SeasonModeRecord {
        wins: non_negative_integer(record.get("wins")).unwrap_or(0.0),
        losses: non_negative_integer(record.get("losses")).unwrap_or(0.0),
        kills: non_negative_integer(record.get("kills")).unwrap_or(0.0),
        deaths: non_negative_integer(record.get("deaths")).unwrap_or(0.0),
    })
}

fn parse_operators(value: Option<&Value>) -> Vec<OperatorStats> {
    value
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|entry| {
            let record = object(entry)?;
            Some(OperatorStats {
                operator: record.get("operator")?.as_str()?.into(),
                rounds_played: non_negative_integer(record.get("rounds_played")).unwrap_or(0.0),
            })
        })
        .collect()
}

pub fn parse_profile_response(value: &Value) -> Result<ProfileResponse, R6Error> {
    let record = object(value)
        .ok_or_else(|| R6Error::Decode("Profile response is missing required fields".into()))?;
    for key in ["id", "user_id", "username", "platform", "max_rank_season"] {
        required_nonblank(record, key)
            .ok_or_else(|| R6Error::Decode("Profile response is missing required fields".into()))?;
    }
    let level = non_negative_integer(record.get("level"))
        .ok_or_else(|| R6Error::Decode("Profile response is missing required fields".into()))?;
    let rank_values = record
        .get("ranked_season_records")
        .and_then(object)
        .ok_or_else(|| R6Error::Decode("Profile response is missing required fields".into()))?;
    let mode_values = record
        .get("season_mode_records")
        .and_then(object)
        .ok_or_else(|| R6Error::Decode("Profile response is missing required fields".into()))?;
    let ranked_season_records = rank_values
        .iter()
        .filter_map(|(season, value)| {
            parse_rank_record(value).map(|parsed| (season.clone(), parsed))
        })
        .collect();
    let mut season_mode_records = BTreeMap::new();
    for (season, modes) in mode_values {
        let Some(modes) = object(modes) else { continue };
        let parsed = modes
            .iter()
            .filter_map(|(mode, value)| parse_mode_record(value).map(|entry| (mode.clone(), entry)))
            .collect();
        season_mode_records.insert(season.clone(), parsed);
    }
    let top = record.get("top_operators").and_then(object);
    Ok(ProfileResponse {
        username: record
            .get("username")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .into(),
        level,
        hs: non_negative_number(record.get("hs")).filter(|number| *number <= 100.0),
        leaderboard_position: positive_integer(record.get("leaderboard_position")),
        max_rank_season: record
            .get("max_rank_season")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .into(),
        ranked_season_records,
        season_mode_records,
        attackers: parse_operators(top.and_then(|value| value.get("attacker"))),
        defenders: parse_operators(top.and_then(|value| value.get("defender"))),
    })
}

fn is_champion(slug: &str) -> bool {
    let lower = slug.to_lowercase();
    lower == "champion" || lower.contains("champion-")
}

fn rank(record: Option<&SeasonRankRecord>, peak: bool) -> Result<RankInfo, R6Error> {
    let Some(record) = record else {
        return slug_to_rank_info(None, 0.0, None);
    };
    let (slug, rp, position) = if peak {
        (
            &record.max_rank,
            record.max_rank_points,
            record.max_rank_position,
        )
    } else {
        (&record.rank, record.rank_points, record.rank_position)
    };
    slug_to_rank_info(
        Some(slug),
        rp,
        is_champion(slug).then_some(position).flatten(),
    )
}

fn capitalize_first_utf16(value: &str) -> String {
    let mut characters = value.chars();
    let Some(first) = characters.next() else {
        return String::new();
    };
    first.to_uppercase().collect::<String>() + characters.as_str()
}

pub fn normalise_profile(
    platform: Platform,
    response: &ProfileResponse,
    current_season: &str,
    ranked_bomb_mode: &str,
) -> Result<PlayerProfile, R6Error> {
    let current_record = response.ranked_season_records.get(current_season);
    let current_rank = rank(current_record, false)?;
    let peak_rank_season = rank(current_record, true)?;
    let peak_rank_all_time = match response
        .ranked_season_records
        .get(&response.max_rank_season)
    {
        Some(record) => rank(Some(record), true)?,
        None => peak_rank_season.clone(),
    };
    let stats = response
        .season_mode_records
        .get(current_season)
        .and_then(|modes| modes.get(ranked_bomb_mode));
    let kills = stats.map_or(0.0, |value| value.kills);
    let deaths = stats.map_or(0.0, |value| value.deaths);
    let wins = stats.map_or(0.0, |value| value.wins);
    let losses = stats.map_or(0.0, |value| value.losses);
    let mut operators: Vec<&OperatorStats> = response
        .attackers
        .iter()
        .chain(&response.defenders)
        .collect();
    operators.sort_by(|left, right| right.rounds_played.total_cmp(&left.rounds_played));
    let top_operator = operators
        .first()
        .filter(|operator| !operator.operator.is_empty())
        .map(|operator| capitalize_first_utf16(&operator.operator));
    Ok(PlayerProfile {
        username: response.username.clone(),
        platform,
        level: response.level,
        current_rank,
        peak_rank_season,
        peak_rank_all_time,
        leaderboard_position: response
            .leaderboard_position
            .filter(|position| *position <= 10_000.0),
        kd: round_js(kills / deaths.max(1.0) * 100.0) / 100.0,
        win_rate: if wins + losses > 0.0 {
            round_js(wins / (wins + losses) * 100.0)
        } else {
            0.0
        },
        kills,
        deaths,
        wins,
        losses,
        headshot_percent: response.hs,
        top_operator,
    })
}
