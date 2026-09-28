from rag_rulebook import has_rulebook, load_chunks


def test_catalogue_rulebooks_are_indexed():
    assert len(load_chunks()) > 0
    for game_name in ("루미큐브", "뱅!", "스플랜더", "카탄", "아줄", "윙스팬", "코드네임", "7원더스"):
        assert has_rulebook(game_name)


def test_unindexed_game_is_not_available():
    assert not has_rulebook("도감에 없는 임의의 게임")
