from game_catalog_metadata import estimated_duration_minutes, format_duration


def test_catalogue_duration_metadata_has_expected_values():
    assert estimated_duration_minutes("루미큐브") == 45
    assert estimated_duration_minutes("테라포밍 마스") == 120
    assert format_duration(60) == "약 1시간"


def test_new_catalogue_game_uses_a_safe_duration_default():
    assert estimated_duration_minutes("새로 등록한 게임") == 45
