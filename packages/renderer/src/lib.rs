mod ansi;
mod rank_art;
mod renderer;

pub use ansi::{pad_right, sanitize_terminal_text, strip_ansi, truncate_text, visual_width};
pub use rank_art::{ART_WIDTH, get_rank_art, normalize_tier};
pub use renderer::{build_stat_lines, render};

#[cfg(test)]
mod tests {
    use r6_client::{Platform, PlayerProfile, tier_to_rank_info};

    use super::*;

    mod ansi_contract {
        use super::*;

        #[test]
        fn strip_ansi_removes_escape_sequences() {
            assert_eq!(strip_ansi("\u{1b}[31mred\u{1b}[0m"), "red");
        }

        #[test]
        fn sanitize_removes_control_and_c1_characters() {
            assert_eq!(sanitize_terminal_text("a\n\u{80}b"), "ab");
        }

        #[test]
        fn visual_width_ignores_combining_marks() {
            assert_eq!(visual_width("e\u{301}"), 1);
        }

        #[test]
        fn visual_width_counts_wide_characters_as_two() {
            assert_eq!(visual_width("界"), 2);
        }

        #[test]
        fn truncate_appends_ellipsis_when_cut() {
            assert_eq!(truncate_text("abcdef", 4), "abc…");
        }

        #[test]
        fn truncate_to_zero_width_is_just_ellipsis() {
            assert_eq!(truncate_text("a", 0), "…");
        }
    }

    mod render_contract {
        use super::*;

        fn empty_profile() -> PlayerProfile {
            PlayerProfile {
                username: "Player".into(),
                platform: Platform::Pc,
                level: 1.0,
                current_rank: tier_to_rank_info(0.0, 0.0),
                peak_rank_season: tier_to_rank_info(0.0, 0.0),
                peak_rank_all_time: tier_to_rank_info(0.0, 0.0),
                current_legends: None,
                peak_legends: None,
                leaderboard_position: None,
                kd: 0.0,
                win_rate: 0.0,
                kills: 0.0,
                deaths: 0.0,
                wins: 0.0,
                losses: 0.0,
                headshot_percent: None,
                top_operator: None,
            }
        }

        #[test]
        fn output_starts_with_blank_line() {
            assert!(render(&empty_profile()).starts_with('\n'));
        }

        #[test]
        fn hides_legends_for_players_without_history() {
            assert!(!render(&empty_profile()).contains("Legends"));
        }

        #[test]
        fn renders_current_and_peak_legends_in_light_blue() {
            let mut profile = empty_profile();
            profile.current_legends = Some(r6_client::LegendsInfo {
                mmr: 5636.0,
                position: Some(1.0),
            });
            profile.peak_legends = Some(r6_client::LegendsInfo {
                mmr: 6000.0,
                position: Some(2.0),
            });
            let lines = build_stat_lines(&profile);
            let legends: Vec<_> = lines
                .iter()
                .filter(|line| line.contains("Legends"))
                .collect();
            assert_eq!(legends.len(), 2);
            assert!(legends[0].contains("\u{1b}[38;2;135;206;250m\u{1b}[1m5,636 MMR · #1"));
            assert!(legends[1].contains("\u{1b}[38;2;135;206;250m\u{1b}[1m6,000 MMR · #2"));
        }

        #[test]
        fn renders_historical_peak_without_current_legends_or_fake_position() {
            let mut profile = empty_profile();
            profile.peak_legends = Some(r6_client::LegendsInfo {
                mmr: 5000.0,
                position: None,
            });
            let output = strip_ansi(&render(&profile));
            let legends: Vec<_> = output
                .lines()
                .filter(|line| line.contains("Legends"))
                .collect();
            assert_eq!(legends.len(), 1);
            assert!(legends[0].contains("Legends Peak     5,000 MMR"));
            assert!(!legends[0].contains('#'));
        }

        #[test]
        fn output_ends_with_blank_line() {
            assert!(render(&empty_profile()).ends_with("\n\n"));
        }

        #[test]
        fn unranked_art_has_expected_height() {
            assert_eq!(get_rank_art(0.0, None).len(), 18);
        }
    }
}
