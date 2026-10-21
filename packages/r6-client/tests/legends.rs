use r6_client::{LegendsInfo, Platform, PlayerProfile, normalise_profile, parse_profile_response};
use serde_json::{Value, json};

fn spoit() -> Value {
    serde_json::from_str(include_str!("fixtures/spoit-legends.json")).unwrap()
}

fn normalise(value: &Value) -> PlayerProfile {
    let response = parse_profile_response(value).unwrap();
    normalise_profile(Platform::Pc, &response, "split-fire", "ranked-bomb").unwrap()
}

#[test]
fn reads_spoit_current_mmr_and_legend_position() {
    assert_eq!(
        normalise(&spoit()).current_legends,
        Some(LegendsInfo {
            mmr: 5636.0,
            position: Some(1.0)
        })
    );
}

#[test]
fn reads_spoit_peak_mmr_and_legend_position() {
    assert_eq!(
        normalise(&spoit()).peak_legends,
        normalise(&spoit()).current_legends
    );
}

#[test]
fn reads_peak_fields_independently_from_current_fields() {
    let mut value = spoit();
    let record = &mut value["legend_season_records"]["split-fire"];
    record["max_rank_points"] = json!(5800);
    record["max_position"] = json!(2);
    assert_eq!(
        normalise(&value).peak_legends,
        Some(LegendsInfo {
            mmr: 5800.0,
            position: Some(2.0)
        })
    );
}

#[test]
fn absent_legends_history_preserves_existing_json_shape() {
    let mut value = spoit();
    value
        .as_object_mut()
        .unwrap()
        .remove("legend_season_records");
    let output = serde_json::to_value(normalise(&value)).unwrap();
    assert!(output.get("currentLegends").is_none() && output.get("peakLegends").is_none());
}

#[test]
fn selects_highest_peak_mmr_with_its_own_position() {
    let mut value = spoit();
    value["legend_season_records"]["previous"] = json!({
        "season": "previous", "max_rank": "legend-division",
        "max_rank_points": 6000, "max_position": 7
    });
    assert_eq!(
        normalise(&value).peak_legends,
        Some(LegendsInfo {
            mmr: 6000.0,
            position: Some(7.0)
        })
    );
}

#[test]
fn does_not_treat_a_previous_season_as_current() {
    let response = parse_profile_response(&spoit()).unwrap();
    let profile = normalise_profile(Platform::Pc, &response, "next-season", "ranked-bomb").unwrap();
    assert_eq!(
        (
            profile.current_legends,
            profile.peak_legends.map(|peak| peak.mmr)
        ),
        (None, Some(5636.0))
    );
}

#[test]
fn missing_or_malformed_optional_records_do_not_break_profiles() {
    for records in [
        Value::Null,
        json!([]),
        json!({}),
        json!({"split-fire": false}),
    ] {
        let mut value = spoit();
        value["legend_season_records"] = records;
        let profile = normalise(&value);
        assert_eq!(
            (profile.current_legends, profile.peak_legends),
            (None, None)
        );
    }
}

#[test]
fn invalid_mmr_is_hidden_without_dropping_valid_peak() {
    for mmr in [json!(-1), json!("5636"), Value::Null] {
        let mut value = spoit();
        value["legend_season_records"]["split-fire"]["rank_points"] = mmr;
        let profile = normalise(&value);
        assert_eq!(
            (
                profile.current_legends,
                profile.peak_legends.map(|peak| peak.mmr)
            ),
            (None, Some(5636.0))
        );
    }
}

#[test]
fn invalid_positions_are_omitted_without_dropping_mmr() {
    for position in [json!(0), json!(-1), json!(1.5), json!("1"), Value::Null] {
        let mut value = spoit();
        value["legend_season_records"]["split-fire"]["position"] = position;
        assert_eq!(
            normalise(&value).current_legends,
            Some(LegendsInfo {
                mmr: 5636.0,
                position: None
            })
        );
    }
}

#[test]
fn unplayed_rank_does_not_show_legends_even_with_default_mmr() {
    let mut value = spoit();
    let record = &mut value["legend_season_records"]["split-fire"];
    record["rank"] = json!("v7-unranked");
    record["max_rank"] = json!("v7-unranked");
    let profile = normalise(&value);
    assert_eq!(
        (profile.current_legends, profile.peak_legends),
        (None, None)
    );
}
