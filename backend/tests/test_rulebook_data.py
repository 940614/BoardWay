from rag_rulebook import has_rulebook, load_chunks


def test_four_rulebooks_are_indexed():
    assert len(load_chunks()) > 0
    for game_name in ("루미큐브", "뱅!", "스플랜더", "카탄"):
        assert has_rulebook(game_name)


def test_unindexed_game_is_not_available():
    assert not has_rulebook("아줄")
