mod normalise;
mod ranks;
mod types;

pub use normalise::{
    ConfigResponse, normalise_profile, parse_config_response, parse_profile_response,
};
pub use ranks::{RANK_NAMES, rank_name_to_tier, round_js, slug_to_rank_info, tier_to_rank_info};
pub use types::{Platform, PlayerProfile, ProfileResponse, R6Error, RankInfo};

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn rank_conversion_matches_boundaries_and_legacy_champion() {
        assert_eq!(tier_to_rank_info(0.5, 100.0).name, "Copper V");
        assert_eq!(tier_to_rank_info(-0.5, 100.0).tier, 0.0);
        assert_eq!(tier_to_rank_info(99.0, 100.0).tier, 40.0);
        let champion = slug_to_rank_info(Some("v7-champion"), 5000.0, Some(12.0)).unwrap();
        assert_eq!(champion.name, "Champion");
        assert_eq!(champion.champ_number, Some(12.0));
        assert!(slug_to_rank_info(Some("future-rank"), 0.0, None).is_err());
    }

    #[test]
    fn profile_parser_rejects_required_fields_and_defaults_optionals() {
        let value = json!({
            "id": "id", "user_id": "user", "username": "Player", "platform": "pc",
            "level": 10, "max_rank_season": "Y10S2",
            "ranked_season_records": {}, "season_mode_records": {},
            "hs": 101, "leaderboard_position": 0,
            "top_operators": { "attacker": [{"operator": "sledge", "rounds_played": 5}] }
        });
        let parsed = parse_profile_response(&value).unwrap();
        assert_eq!(parsed.hs, None);
        assert_eq!(parsed.leaderboard_position, None);
        assert_eq!(parsed.attackers.len(), 1);
        assert!(parse_profile_response(&json!({})).is_err());
    }

    #[test]
    fn normalization_preserves_ties_and_zero_deaths() {
        let value = json!({
            "id": "id", "user_id": "user", "username": "Player", "platform": "pc",
            "level": 10, "max_rank_season": "Y10S2",
            "ranked_season_records": {"Y10S2": {
                "season": "Y10S2", "rank": "gold-i", "max_rank": "platinum-v",
                "rank_points": 3000, "max_rank_points": 3200
            }},
            "season_mode_records": {"Y10S2": {"ranked": {
                "season": "Y10S2", "mode": "ranked", "kills": 5, "deaths": 0,
                "wins": 1, "losses": 1
            }}},
            "top_operators": {
                "attacker": [{"operator": "sledge", "rounds_played": 4}],
                "defender": [{"operator": "smoke", "rounds_played": 4}]
            }
        });
        let parsed = parse_profile_response(&value).unwrap();
        let profile = normalise_profile(Platform::Pc, &parsed, "Y10S2", "ranked").unwrap();
        assert_eq!(profile.kd, 5.0);
        assert_eq!(profile.deaths, 0.0);
        assert_eq!(profile.win_rate, 50.0);
        assert_eq!(profile.top_operator.as_deref(), Some("Sledge"));
    }
}
