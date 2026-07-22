use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Pc,
    Ps,
    Xbox,
}

impl Platform {
    #[must_use]
    pub fn parse(value: &str) -> Option<Self> {
        match value {
            "pc" => Some(Self::Pc),
            "ps" => Some(Self::Ps),
            "xbox" => Some(Self::Xbox),
            _ => None,
        }
    }

    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Pc => "pc",
            Self::Ps => "ps",
            Self::Xbox => "xbox",
        }
    }

    #[must_use]
    pub const fn api_name(self) -> &'static str {
        match self {
            Self::Pc => "pc",
            Self::Ps => "playstation",
            Self::Xbox => "xbox",
        }
    }
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RankInfo {
    pub name: String,
    pub tier: f64,
    pub rp: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub champ_number: Option<f64>,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerProfile {
    pub username: String,
    pub platform: Platform,
    pub level: f64,
    pub current_rank: RankInfo,
    pub peak_rank_season: RankInfo,
    pub peak_rank_all_time: RankInfo,
    pub leaderboard_position: Option<f64>,
    pub kd: f64,
    pub win_rate: f64,
    pub kills: f64,
    pub deaths: f64,
    pub wins: f64,
    pub losses: f64,
    pub headshot_percent: Option<f64>,
    pub top_operator: Option<String>,
}

#[derive(Clone, Debug)]
pub struct SeasonRankRecord {
    pub rank: String,
    pub max_rank: String,
    pub rank_points: f64,
    pub max_rank_points: f64,
    pub rank_position: Option<f64>,
    pub max_rank_position: Option<f64>,
}

#[derive(Clone, Debug, Default)]
pub struct SeasonModeRecord {
    pub wins: f64,
    pub losses: f64,
    pub kills: f64,
    pub deaths: f64,
}

#[derive(Clone, Debug)]
pub struct OperatorStats {
    pub operator: String,
    pub rounds_played: f64,
}

#[derive(Clone, Debug)]
pub struct ProfileResponse {
    pub username: String,
    pub level: f64,
    pub hs: Option<f64>,
    pub leaderboard_position: Option<f64>,
    pub max_rank_season: String,
    pub ranked_season_records: BTreeMap<String, SeasonRankRecord>,
    pub season_mode_records: BTreeMap<String, BTreeMap<String, SeasonModeRecord>>,
    pub attackers: Vec<OperatorStats>,
    pub defenders: Vec<OperatorStats>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum R6Error {
    InvalidInput(String),
    PlayerNotFound { username: String, platform: String },
    Api(String),
    Decode(String),
    Configuration(String),
}

impl fmt::Display for R6Error {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidInput(message)
            | Self::Api(message)
            | Self::Decode(message)
            | Self::Configuration(message) => formatter.write_str(message),
            Self::PlayerNotFound { username, platform } => {
                write!(formatter, "Player '{username}' not found on {platform}")
            }
        }
    }
}

impl std::error::Error for R6Error {}
