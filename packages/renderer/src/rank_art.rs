use std::sync::LazyLock;

use serde::Deserialize;

use r6_client::round_js;

pub const ART_WIDTH: usize = 36;
const WHITE: &str = "\u{1b}[38;2;255;255;255m";
const RESET: &str = "\u{1b}[0m";
const BRAILLE_BITS: [[u32; 2]; 4] = [[1, 8], [2, 16], [4, 32], [64, 128]];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RankArtData {
    width: usize,
    pub colors: Vec<[u8; 3]>,
    art: Vec<Vec<String>>,
    champion_cells: Vec<Vec<String>>,
    champion_digits: Vec<Vec<String>>,
}

pub(crate) static DATA: LazyLock<RankArtData> = LazyLock::new(|| {
    let data: RankArtData = serde_json::from_str(include_str!("rank-art-data.json"))
        .unwrap_or_else(|error| panic!("generated rank art is invalid: {error}"));
    assert_eq!(data.width, ART_WIDTH, "generated rank art width differs");
    data
});

pub fn normalize_tier(tier: f64) -> usize {
    if tier.is_finite() {
        round_js(tier).clamp(0.0, 40.0) as usize
    } else {
        0
    }
}

fn champion_number_art(position: u32) -> Vec<String> {
    let digits: Vec<&Vec<String>> = position
        .to_string()
        .chars()
        .filter_map(|digit| {
            digit
                .to_digit(10)
                .and_then(|number| DATA.champion_digits.get(number as usize))
        })
        .collect();
    let Some(first) = digits.first() else {
        return DATA.art.get(40).cloned().unwrap_or_default();
    };
    let height = first.len();
    let width: usize = digits
        .iter()
        .map(|digit| digit.first().map_or(0, String::len))
        .sum::<usize>()
        + digits.len().saturating_sub(1);
    let start_x = (ART_WIDTH * 2).saturating_sub(width) / 2;
    let start_y = 25;
    let mut masks = vec![vec![0_u32; ART_WIDTH]; DATA.champion_cells.len()];
    let mut x_offset = start_x;
    for digit in digits {
        for (y, row) in digit.iter().take(height).enumerate() {
            for (x, byte) in row.bytes().enumerate() {
                if byte != b'1' {
                    continue;
                }
                let pixel_x = x_offset + x;
                let pixel_y = start_y + y;
                if let Some(cell) = masks
                    .get_mut(pixel_y / 4)
                    .and_then(|row| row.get_mut(pixel_x / 2))
                {
                    *cell += BRAILLE_BITS[pixel_y % 4][pixel_x % 2];
                }
            }
        }
        x_offset += digit.first().map_or(0, String::len) + 1;
    }
    DATA.champion_cells
        .iter()
        .enumerate()
        .map(|(row_index, row)| {
            row.iter()
                .enumerate()
                .map(|(column, cell)| {
                    let mask = masks
                        .get(row_index)
                        .and_then(|row| row.get(column))
                        .copied()
                        .unwrap_or(0);
                    if mask == 0 {
                        cell.clone()
                    } else {
                        format!(
                            "{WHITE}{}{RESET}",
                            char::from_u32(0x2800 + mask).unwrap_or('\u{2800}')
                        )
                    }
                })
                .collect()
        })
        .collect()
}

pub fn get_rank_art(tier: f64, champ_number: Option<f64>) -> Vec<String> {
    let tier = normalize_tier(tier);
    if tier == 40
        && let Some(position) =
            champ_number.filter(|number| number.fract() == 0.0 && (1.0..=9999.0).contains(number))
    {
        return champion_number_art(position as u32);
    }
    DATA.art
        .get(tier)
        .or_else(|| DATA.art.first())
        .cloned()
        .unwrap_or_default()
}
