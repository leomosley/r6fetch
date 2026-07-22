const ESC: char = '\u{1b}';

fn is_control(code: u32) -> bool {
    code <= 0x1f || (0x7f..=0x9f).contains(&code)
}
fn is_zero_width(code: u32) -> bool {
    matches!(code, 0x200b..=0x200d | 0x0300..=0x036f | 0x1ab0..=0x1aff | 0x1dc0..=0x1dff | 0x20d0..=0x20ff | 0xfe00..=0xfe0f | 0xfe20..=0xfe2f)
}
fn is_modifier(code: u32) -> bool {
    (0x1f3fb..=0x1f3ff).contains(&code)
}
fn is_wide(code: u32) -> bool {
    code >= 0x1100
        && (code <= 0x115f
            || matches!(code, 0x2329 | 0x232a | 0x2e80..=0xa4cf | 0xac00..=0xd7a3 | 0xf900..=0xfaff | 0xfe10..=0xfe19 | 0xfe30..=0xfe6f | 0xff00..=0xff60 | 0xffe0..=0xffe6 | 0x1f300..=0x1faff | 0x20000..=0x3fffd))
}

#[must_use]
pub fn strip_ansi(value: &str) -> String {
    let chars: Vec<char> = value.chars().collect();
    let mut output = String::new();
    let mut index = 0;
    while index < chars.len() {
        if chars[index] == ESC && chars.get(index + 1) == Some(&'[') {
            let mut cursor = index + 2;
            while chars.get(cursor).is_some_and(|c| ('0'..='?').contains(c)) {
                cursor += 1;
            }
            while chars.get(cursor).is_some_and(|c| (' '..='/').contains(c)) {
                cursor += 1;
            }
            if chars.get(cursor).is_some_and(|c| ('@'..='~').contains(c)) {
                index = cursor + 1;
                continue;
            }
        }
        output.push(chars[index]);
        index += 1;
    }
    output
}

#[must_use]
pub fn sanitize_terminal_text(value: &str) -> String {
    value
        .chars()
        .filter(|character| !is_control(*character as u32))
        .collect()
}

fn clusters(value: &str) -> Vec<String> {
    let mut result: Vec<String> = Vec::new();
    for character in value.chars() {
        let join = result.last().is_some_and(|previous| {
            is_zero_width(character as u32)
                || is_modifier(character as u32)
                || previous.ends_with('\u{200d}')
        });
        if join {
            if let Some(previous) = result.last_mut() {
                previous.push(character);
            }
        } else {
            result.push(character.to_string());
        }
    }
    result
}

#[must_use]
pub fn visual_width(value: &str) -> usize {
    clusters(&strip_ansi(value))
        .iter()
        .map(|cluster| {
            cluster.chars().fold(0, |width, character| {
                let code = character as u32;
                if is_control(code) || is_zero_width(code) {
                    width
                } else {
                    width.max(if is_wide(code) { 2 } else { 1 })
                }
            })
        })
        .sum()
}

#[must_use]
pub fn truncate_text(value: &str, max_width: usize) -> String {
    let sanitized = sanitize_terminal_text(value);
    if visual_width(&sanitized) <= max_width {
        return sanitized;
    }
    let mut output = String::new();
    for cluster in clusters(&sanitized) {
        if visual_width(&(output.clone() + &cluster + "…")) > max_width {
            break;
        }
        output.push_str(&cluster);
    }
    output.push('…');
    output
}

#[must_use]
pub fn pad_right(value: &str, width: usize) -> String {
    format!(
        "{value}{}",
        " ".repeat(width.saturating_sub(visual_width(value)))
    )
}
