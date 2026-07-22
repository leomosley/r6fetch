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

    mod tier_to_rank_info {
        use super::*;

        #[test]
        fn rounds_half_tier_up_to_named_rank() {
            assert_eq!(tier_to_rank_info(0.5, 100.0).name, "Copper V");
        }

        #[test]
        fn clamps_negative_tier_to_zero() {
            assert_eq!(tier_to_rank_info(-0.5, 100.0).tier, 0.0);
        }

        #[test]
        fn clamps_out_of_range_tier_to_champion() {
            assert_eq!(tier_to_rank_info(99.0, 100.0).tier, 40.0);
        }
    }

    mod slug_to_rank_info {
        use super::*;

        #[test]
        fn resolves_legacy_champion_name() {
            let champion = slug_to_rank_info(Some("v7-champion"), 5000.0, Some(12.0)).unwrap();
            assert_eq!(champion.name, "Champion");
        }

        #[test]
        fn preserves_champion_number() {
            let champion = slug_to_rank_info(Some("v7-champion"), 5000.0, Some(12.0)).unwrap();
            assert_eq!(champion.champ_number, Some(12.0));
        }

        #[test]
        fn rejects_unknown_slug() {
            assert!(slug_to_rank_info(Some("future-rank"), 0.0, None).is_err());
        }
    }

    mod parse_profile_response {
        use super::*;

        fn minimal_profile() -> serde_json::Value {
            json!({
                "id": "id", "user_id": "user", "username": "Player", "platform": "pc",
                "level": 10, "max_rank_season": "Y10S2",
                "ranked_season_records": {}, "season_mode_records": {},
                "hs": 101, "leaderboard_position": 0,
                "top_operators": { "attacker": [{"operator": "sledge", "rounds_played": 5}] }
            })
        }

        #[test]
        fn drops_out_of_range_headshot_percent() {
            let parsed = parse_profile_response(&minimal_profile()).unwrap();
            assert_eq!(parsed.hs, None);
        }

        #[test]
        fn drops_non_positive_leaderboard_position() {
            let parsed = parse_profile_response(&minimal_profile()).unwrap();
            assert_eq!(parsed.leaderboard_position, None);
        }

        #[test]
        fn keeps_valid_attacker_operators() {
            let parsed = parse_profile_response(&minimal_profile()).unwrap();
            assert_eq!(parsed.attackers.len(), 1);
        }

        #[test]
        fn rejects_empty_object() {
            assert!(parse_profile_response(&json!({})).is_err());
        }
    }

    mod normalise_profile {
        use super::*;

        fn profile_with_zero_deaths() -> PlayerProfile {
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
            normalise_profile(Platform::Pc, &parsed, "Y10S2", "ranked").unwrap()
        }

        #[test]
        fn treats_zero_deaths_as_one_for_kd() {
            assert_eq!(profile_with_zero_deaths().kd, 5.0);
        }

        #[test]
        fn preserves_zero_deaths_in_output() {
            assert_eq!(profile_with_zero_deaths().deaths, 0.0);
        }

        #[test]
        fn computes_win_rate_from_wins_and_losses() {
            assert_eq!(profile_with_zero_deaths().win_rate, 50.0);
        }

        #[test]
        fn picks_most_played_operator_on_tie_by_order() {
            assert_eq!(
                profile_with_zero_deaths().top_operator.as_deref(),
                Some("Sledge")
            );
        }
    }
}
