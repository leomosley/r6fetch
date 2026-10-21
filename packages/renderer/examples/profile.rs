use std::io::{self, Read};

use r6_client::{Platform, normalise_profile, parse_profile_response};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let season = std::env::args().nth(1).ok_or("Usage: profile <season>")?;
    let mut input = String::new();
    io::stdin().read_to_string(&mut input)?;
    let value = serde_json::from_str(&input)?;
    let response = parse_profile_response(&value)?;
    let profile = normalise_profile(Platform::Pc, &response, &season, "ranked-bomb")?;
    print!("{}", renderer::render(&profile));
    Ok(())
}
