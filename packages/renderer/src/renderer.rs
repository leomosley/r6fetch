use crate::rank_art::DATA;
use r6_client::{PlayerProfile, RankInfo};

use crate::{ART_WIDTH, get_rank_art, normalize_tier, pad_right, truncate_text, visual_width};

const RESET: &str = "\u{1b}[0m";
const BOLD: &str = "\u{1b}[1m";
const DIM: &str = "\u{1b}[2m";
const GREY: &str = "\u{1b}[38;2;160;160;160m";
const WHITE: &str = "\u{1b}[38;2;230;230;230m";
const KEY_WIDTH: usize = 15;

fn grouped_integer(value: f64) -> String {
    let integer = if value.is_finite() && value >= 0.0 && value.fract() == 0.0 {
        value
    } else {
        0.0
    };
    let raw = format!("{integer:.0}");
    let mut output = String::new();
    for (index, character) in raw.chars().enumerate() {
        if index > 0 && (raw.len() - index).is_multiple_of(3) {
            output.push(',');
        }
        output.push(character);
    }
    output
}

fn grouped_number(value: f64) -> String {
    let rounded = r6_client::round_js(value * 1000.0) / 1000.0;
    if rounded.fract() == 0.0 {
        return grouped_integer(value);
    }
    let raw = fixed_js(rounded, 3)
        .trim_end_matches('0')
        .trim_end_matches('.')
        .to_string();
    let (integer, fraction) = raw.split_once('.').unwrap_or((&raw, ""));
    let grouped = grouped_integer(integer.parse().unwrap_or(0.0));
    if fraction.is_empty() {
        grouped
    } else {
        format!("{grouped}.{fraction}")
    }
}

fn fixed_js(value: f64, digits: u32) -> String {
    let factor = 10_u64.pow(digits) as f64;
    let rounded = r6_client::round_js(value * factor).max(0.0);
    let integer = (rounded / factor).floor();
    if digits == 0 {
        return format!("{integer:.0}");
    }
    let fraction = (rounded - integer * factor).round() as u64;
    format!("{integer:.0}.{fraction:0width$}", width = digits as usize)
}

fn positive_integer(value: Option<f64>) -> Option<f64> {
    value.filter(|number| number.is_finite() && number.fract() == 0.0 && *number > 0.0)
}

fn rank_text(rank: &RankInfo, fallback_position: Option<f64>) -> String {
    let color = DATA
        .colors
        .get(normalize_tier(rank.tier))
        .or_else(|| DATA.colors.first())
        .copied()
        .unwrap_or([230; 3]);
    let color = format!("\u{1b}[38;2;{};{};{}m", color[0], color[1], color[2]);
    let rp = if rank.rp.is_finite() && rank.rp >= 0.0 {
        rank.rp
    } else {
        0.0
    };
    let rp_text = if rp > 0.0 {
        format!("{DIM} · {RESET}{GREY}{} RP{RESET}", grouped_number(rp))
    } else {
        String::new()
    };
    let position =
        positive_integer(rank.champ_number).or_else(|| positive_integer(fallback_position));
    let position_text = position.map_or_else(String::new, |number| {
        format!("{DIM} · {RESET}{GREY}#{}{RESET}", grouped_integer(number))
    });
    format!(
        "{color}{BOLD}{}{RESET}{rp_text}{position_text}",
        truncate_text(&rank.name, 20)
    )
}

enum Line {
    Header(String),
    Separator,
    Stat(&'static str, String),
}

#[must_use]
pub fn build_stat_lines(profile: &PlayerProfile) -> Vec<String> {
    let safe = |number: f64| {
        if number.is_finite() && number >= 0.0 {
            number
        } else {
            0.0
        }
    };
    let mut lines = vec![
        Line::Header(format!(
            "{BOLD}{WHITE}{}{RESET}  {DIM}@ {}{RESET}",
            truncate_text(&profile.username, 24),
            profile.platform.as_str()
        )),
        Line::Separator,
        Line::Stat("Level", grouped_integer(profile.level)),
        Line::Separator,
        Line::Stat(
            "Current Rank",
            rank_text(&profile.current_rank, profile.leaderboard_position),
        ),
        Line::Stat("Season Peak", rank_text(&profile.peak_rank_season, None)),
        Line::Stat(
            "All-Time Peak",
            rank_text(&profile.peak_rank_all_time, None),
        ),
        Line::Separator,
        Line::Stat("K/D", fixed_js(safe(profile.kd), 2)),
        Line::Stat(
            "Win Rate",
            format!("{}%", fixed_js(safe(profile.win_rate).min(100.0), 0)),
        ),
        Line::Stat("Kills", grouped_integer(profile.kills)),
        Line::Stat("Deaths", grouped_integer(profile.deaths)),
        Line::Stat(
            "Wins / Losses",
            format!(
                "{} / {}",
                grouped_integer(profile.wins),
                grouped_integer(profile.losses)
            ),
        ),
    ];
    if let Some(headshot) = profile.headshot_percent {
        lines.push(Line::Stat(
            "Headshot %",
            format!("{}%", fixed_js(safe(headshot).min(100.0), 1)),
        ));
    }
    if let Some(operator) = &profile.top_operator {
        lines.push(Line::Stat("Top Operator", truncate_text(operator, 20)));
    }
    let max_width = lines
        .iter()
        .map(|line| match line {
            Line::Header(text) => visual_width(text),
            Line::Stat(_, value) => KEY_WIDTH + 2 + visual_width(value),
            Line::Separator => 0,
        })
        .max()
        .unwrap_or(0);
    lines
        .into_iter()
        .map(|line| match line {
            Line::Header(text) => text,
            Line::Separator => format!("{DIM}{}{RESET}", "─".repeat(max_width)),
            Line::Stat(key, value) => format!(
                "{}  {WHITE}{value}{RESET}",
                pad_right(&format!("{GREY}{key}{RESET}"), KEY_WIDTH)
            ),
        })
        .collect()
}

#[must_use]
pub fn render(profile: &PlayerProfile) -> String {
    let art = get_rank_art(profile.current_rank.tier, profile.current_rank.champ_number);
    let stats = build_stat_lines(profile);
    let height = art.len().max(stats.len());
    let rows: Vec<String> = (0..height)
        .map(|index| {
            let art_line = art
                .get(index)
                .cloned()
                .unwrap_or_else(|| " ".repeat(ART_WIDTH));
            let padded = pad_right(&art_line, ART_WIDTH);
            stats
                .get(index)
                .map_or(padded.clone(), |stat| format!("{padded}    {stat}"))
        })
        .collect();
    format!("\n{}\n\n", rows.join("\n"))
}
