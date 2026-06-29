"""sync full game catalog

Revision ID: f4a7c8e1b2d3
Revises: e3b9a1c4d2f6
"""

from typing import Sequence, Union
from pathlib import Path
import ast

from alembic import op
import sqlalchemy as sa


revision: str = "f4a7c8e1b2d3"
down_revision: Union[str, Sequence[str], None] = "e3b9a1c4d2f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _load_games_data() -> list[dict]:
    """Read GAMES_DATA from seed.py without importing app modules."""
    seed_path = Path(__file__).resolve().parents[2] / "seed.py"
    tree = ast.parse(seed_path.read_text(encoding="utf-8"))
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "GAMES_DATA":
                    return ast.literal_eval(node.value)
    raise RuntimeError("GAMES_DATA not found in seed.py")


def upgrade() -> None:
    conn = op.get_bind()
    games_data = _load_games_data()

    for game in games_data:
        params = {
            "game_id": game["id"],
            "name": game["name"],
            "players": game["players"],
            "difficulty": game["difficulty"],
            "genre": game.get("genre"),
            "description": game["description"],
            "rule_url": game["ruleUrl"],
            "image": game["image"],
        }
        conn.execute(
            sa.text(
                """
                INSERT INTO games
                    (game_id, name, players, difficulty, genre, description, "ruleUrl", image)
                VALUES
                    (:game_id, :name, :players, :difficulty, :genre, :description, :rule_url, :image)
                ON CONFLICT (game_id) DO UPDATE SET
                    name = EXCLUDED.name,
                    players = EXCLUDED.players,
                    difficulty = EXCLUDED.difficulty,
                    genre = EXCLUDED.genre,
                    description = EXCLUDED.description,
                    "ruleUrl" = EXCLUDED."ruleUrl",
                    image = EXCLUDED.image
                """
            ),
            params,
        )


def downgrade() -> None:
    # Keep catalog rows on downgrade to avoid deleting production data.
    pass
