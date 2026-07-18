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

    #[test]
    fn ansi_width_and_sanitization_match_terminal_contract() {
        assert_eq!(strip_ansi("\u{1b}[31mred\u{1b}[0m"), "red");
        assert_eq!(sanitize_terminal_text("a\n\u{80}b"), "ab");
        assert_eq!(visual_width("e\u{301}"), 1);
        assert_eq!(visual_width("界"), 2);
        assert_eq!(truncate_text("abcdef", 4), "abc…");
        assert_eq!(truncate_text("a", 0), "…");
    }

    #[test]
    fn renderer_keeps_framing_and_generated_art_dimensions() {
        let profile = PlayerProfile {
            username: "Player".into(),
            platform: Platform::Pc,
            level: 1.0,
            current_rank: tier_to_rank_info(0.0, 0.0),
            peak_rank_season: tier_to_rank_info(0.0, 0.0),
            peak_rank_all_time: tier_to_rank_info(0.0, 0.0),
            leaderboard_position: None,
            kd: 0.0,
            win_rate: 0.0,
            kills: 0.0,
            deaths: 0.0,
            wins: 0.0,
            losses: 0.0,
            headshot_percent: None,
            top_operator: None,
        };
        let output = render(&profile);
        assert!(output.starts_with('\n'));
        assert!(output.ends_with("\n\n"));
        assert_eq!(get_rank_art(0.0, None).len(), 18);
    }
}
