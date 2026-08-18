"""Тестове на FWI worker-а — мапването от съобщение към редове и идемпотентността.

Без база: `process_message` получава връзката отвън, така че фалшив cursor стига, за да
се провери какво точно се праща към TimescaleDB. Дедупът е тестван на ниво SQL (има ли
ON CONFLICT) — че уникалният индекс работи е работа на миграция V3, не на worker-а.
"""
import json

import pytest

from worker import process_message


class FakeCursor:
    def __init__(self, rowcount):
        self.rowcount = rowcount
        self.sql = None
        self.rows = None

    def executemany(self, sql, rows):
        self.sql = sql
        self.rows = list(rows)

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class FakeDb:
    """Колкото psycopg връзка е нужна на process_message, и нищо повече."""

    def __init__(self, rowcount=None):
        self._cursor = FakeCursor(rowcount)
        self.commits = 0

    def cursor(self):
        return self._cursor

    def commit(self):
        self.commits += 1


def message(points, date="2026-06-18", source="effis-downloader"):
    return json.dumps({
        "message_id": "11111111-2222-3333-4444-555555555555",
        "timestamp": f"{date}T06:00:00Z",
        "source": source,
        "payload": {"date": date, "resolution_km": 8, "points": points},
    }).encode()


POINTS = [
    {"lat": 42.5, "lon": 25.0, "fwi": 18.4, "fwi_class": 4},
    {"lat": 42.6, "lon": 25.1, "fwi": 21.2, "fwi_class": 5},
]


def test_maps_points_in_contract_order():
    """Редът на колоните е (time, lat, lon, source, fwi, class) — виж раздел 5 от договора."""
    db = FakeDb(rowcount=2)
    process_message(message(POINTS), db)
    assert db.cursor().rows == [
        ("2026-06-18", 42.5, 25.0, "effis-downloader", 18.4, 4),
        ("2026-06-18", 42.6, 25.1, "effis-downloader", 21.2, 5),
    ]


def test_insert_is_idempotent():
    """Без ON CONFLICT всеки рестарт на downloader-а добавяше още едно копие на решетката."""
    db = FakeDb(rowcount=2)
    process_message(message(POINTS), db)
    assert "ON CONFLICT DO NOTHING" in db.cursor().sql


def test_reports_skipped_duplicates():
    """Втори път същото съобщение → базата връща 0 записани, но 2 получени."""
    db = FakeDb(rowcount=0)
    assert process_message(message(POINTS), db) == (0, 2)


def test_counts_written_rows():
    db = FakeDb(rowcount=2)
    assert process_message(message(POINTS), db) == (2, 2)
    assert db.commits == 1


def test_unknown_rowcount_counts_everything_as_written():
    """Драйвер, който не знае колко реда е засегнал (-1), не бива да меси гадания в лога."""
    db = FakeDb(rowcount=-1)
    assert process_message(message(POINTS), db) == (2, 2)


def test_missing_source_falls_back():
    """`source` липсва в плика → записва се 'unknown', не гърми."""
    body = json.dumps({"payload": {"date": "2026-06-18", "points": POINTS}}).encode()
    db = FakeDb(rowcount=2)
    process_message(body, db)
    assert db.cursor().rows[0][3] == "unknown"


@pytest.mark.parametrize(
    "body, name",
    [
        (b"not json at all", "невалиден JSON"),
        (json.dumps({"source": "x"}).encode(), "липсва payload"),
        (json.dumps({"payload": {"date": "2026-06-18"}}).encode(), "липсват points"),
        (message([{"lat": 42.5, "lon": 25.0, "fwi": 18.4}]), "точка без fwi_class"),
    ],
)
def test_broken_messages_raise_so_they_reach_the_dlq(body, name):
    """Worker-ът разчита на изключение, за да nack-не съобщението към weather.dlq."""
    with pytest.raises(Exception):
        process_message(body, FakeDb(rowcount=0))
