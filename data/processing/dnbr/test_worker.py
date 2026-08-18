"""Тестове на dNBR worker-а — валидацията на задачата и пътят до MinIO/базата.

Без RabbitMQ, без MinIO и без база: сцените се пишат като истински GeoTIFF-ове във
временна папка, а S3 клиентът и връзката към базата са фалшиви.
"""
import json
import shutil

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds

from worker import analyse, parse_task, process_message, store_summary

BBOX = [25.0, 42.4, 25.5, 42.8]
SIZE = 8

# Отражения: жива гора (висок NIR, нисък SWIR) → NBR ≈ 0.6; изгоряло → NBR ≈ -0.35.
HEALTHY = (4000.0, 1000.0)
BURNT = (1200.0, 2500.0)


def write_scene(path, nir_value, swir_value, bands=("B08", "B12"), size=SIZE):
    first, second = (nir_value, swir_value) if bands[0] == "B08" else (swir_value, nir_value)
    profile = {
        "driver": "GTiff", "width": size, "height": size, "count": 2,
        "dtype": "float32", "crs": "EPSG:4326",
        "transform": from_bounds(*BBOX, size, size),
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(np.full((size, size), first, dtype="float32"), 1)
        dst.write(np.full((size, size), second, dtype="float32"), 2)
    return str(path)


def task_message(fire_id=42, bands=("B08", "B12"), bbox=BBOX, **overrides):
    payload = {
        "fire_id": fire_id,
        "bucket": "satellite-imagery",
        "tile": "T34TGN",
        "bbox": bbox,
        "crs": "EPSG:4326",
        "bands": list(bands),
        "pre": {"path": "sentinel2/2026-07-01/T34TGN_pre.tif", "date": "2026-07-01"},
        "post": {"path": "sentinel2/2026-07-20/T34TGN_post.tif", "date": "2026-07-20"},
    }
    payload.update(overrides)
    return json.dumps({
        "message_id": "11111111-2222-3333-4444-555555555555",
        "timestamp": "2026-07-21T06:00:00Z",
        "source": "sentinel-fetcher",
        "payload": payload,
    }).encode()


# --- валидация на задачата -------------------------------------------------------

def test_parse_task_keeps_what_the_worker_needs():
    task = parse_task(task_message())
    assert task["fire_id"] == 42
    assert task["pre"]["date"] == "2026-07-01"
    assert task["bbox"] == BBOX


def test_analysis_without_a_fire_is_allowed():
    """Район, посочен на ръка, няма fire_id — това е валиден случай, не грешка."""
    assert parse_task(task_message(fire_id=None))["fire_id"] is None


@pytest.mark.parametrize(
    "body, name",
    [
        (b"{}", "празно съобщение"),
        (task_message(bands=("B04", "B08")), "грешни канали за dNBR"),
        (task_message(bbox=[25.0, 42.4]), "непълен bbox"),
        (json.dumps({"payload": {"bucket": "b", "bands": ["B08", "B12"], "bbox": BBOX,
                                 "post": {"path": "p", "date": "d"}}}).encode(), "липсва сцена преди"),
        (json.dumps({"payload": {"bucket": "b", "bands": ["B08", "B12"], "bbox": BBOX,
                                 "pre": {"path": "p"},
                                 "post": {"path": "p", "date": "d"}}}).encode(), "сцена без дата"),
    ],
)
def test_broken_tasks_are_rejected_before_any_download(body, name):
    """Валидацията е преди сваляне — иначе два растера се дърпат напразно."""
    with pytest.raises((KeyError, ValueError)):
        parse_task(body)


# --- самата сметка ---------------------------------------------------------------

def test_burnt_area_lands_in_the_high_severity_class(tmp_path):
    pre = write_scene(tmp_path / "pre.tif", *HEALTHY)
    post = write_scene(tmp_path / "post.tif", *BURNT)

    dnbr, profile, stats = analyse(pre, post, ["B08", "B12"])

    assert dnbr.mean() > 0.66                       # висока степен по USGS
    assert stats["per_class"]["high"] == pytest.approx(stats["analysed_hectares"])
    assert stats["burned_hectares"] == pytest.approx(stats["analysed_hectares"])
    assert stats["per_class"]["unburned"] == 0.0


def test_unchanged_forest_is_not_reported_as_burned(tmp_path):
    """Една и съща сцена преди и след → dNBR 0, нула изгорели хектара."""
    pre = write_scene(tmp_path / "pre.tif", *HEALTHY)
    post = write_scene(tmp_path / "post.tif", *HEALTHY)

    dnbr, _, stats = analyse(pre, post, ["B08", "B12"])

    assert dnbr.mean() == pytest.approx(0.0)
    assert stats["burned_hectares"] == 0.0
    assert stats["per_class"]["unburned"] == pytest.approx(stats["analysed_hectares"])


def test_band_order_comes_from_the_message(tmp_path):
    """Обърнати канали във файла → обърнат знак на dNBR, тоест пожар изглежда като гора."""
    pre = write_scene(tmp_path / "pre.tif", *HEALTHY, bands=("B12", "B08"))
    post = write_scene(tmp_path / "post.tif", *BURNT, bands=("B12", "B08"))

    dnbr, _, _ = analyse(pre, post, ["B12", "B08"])
    assert dnbr.mean() > 0.66


def test_output_raster_is_one_float_band_with_nodata(tmp_path):
    pre = write_scene(tmp_path / "pre.tif", *HEALTHY)
    post = write_scene(tmp_path / "post.tif", *BURNT)

    _, profile, _ = analyse(pre, post, ["B08", "B12"])
    assert profile["count"] == 1
    assert profile["dtype"] == "float32"
    assert np.isnan(profile["nodata"])
    assert profile["crs"] == rasterio.crs.CRS.from_epsg(4326)


def test_scenes_of_different_sizes_are_rejected(tmp_path):
    pre = write_scene(tmp_path / "pre.tif", *HEALTHY, size=8)
    post = write_scene(tmp_path / "post.tif", *BURNT, size=16)

    with pytest.raises(ValueError, match="различен размер"):
        analyse(pre, post, ["B08", "B12"])


# --- запис ------------------------------------------------------------------------

class FakeCursor:
    def __init__(self):
        self.params = None

    def execute(self, sql, params):
        self.sql, self.params = sql, params

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False


class FakeDb:
    def __init__(self):
        self._cursor = FakeCursor()
        self.commits = 0

    def cursor(self):
        return self._cursor

    def commit(self):
        self.commits += 1


class FakeS3:
    """Сваля от локални файлове и помни какво е качено."""

    def __init__(self, files):
        self.files = files
        self.uploaded = {}

    def download_file(self, _bucket, key, dest):
        shutil.copyfile(self.files[key], dest)

    def upload_file(self, source, bucket, key):
        self.uploaded[f"{bucket}/{key}"] = source


STATS = {
    "per_class": {"regrowth": 1.0, "unburned": 2.0, "low": 3.0,
                  "moderate_low": 4.0, "moderate_high": 5.0, "high": 6.0},
    "burned_hectares": 18.0,
    "analysed_hectares": 21.0,
    "mean_dnbr": 0.42,
}


def test_summary_columns_are_written_in_class_order():
    """Хектарите по класове влизат подредени 1→6 — разместени, отчетът лъже мълчаливо."""
    db = FakeDb()
    store_summary(db, parse_task(task_message()), "processed-products/dnbr/42/x.tif", STATS)

    params = db.cursor().params
    assert params[0] == 42                       # fire_id
    assert params[1:5] == (25.0, 42.4, 25.5, 42.8)  # bbox → ST_MakeEnvelope
    assert params[5:7] == ("2026-07-01", "2026-07-20")
    assert params[-6:] == (1.0, 2.0, 3.0, 4.0, 5.0, 6.0)
    assert db.commits == 1


def test_reanalysis_updates_instead_of_duplicating():
    """Същата двойка сцени, пусната пак, обновява реда — както при FWI точките."""
    db = FakeDb()
    store_summary(db, parse_task(task_message()), "processed-products/dnbr/42/x.tif", STATS)
    assert "ON CONFLICT (fire_id, pre_date, post_date) DO UPDATE" in db.cursor().sql


def test_end_to_end_writes_raster_and_summary(tmp_path):
    pre = write_scene(tmp_path / "pre.tif", *HEALTHY)
    post = write_scene(tmp_path / "post.tif", *BURNT)
    s3 = FakeS3({
        "sentinel2/2026-07-01/T34TGN_pre.tif": pre,
        "sentinel2/2026-07-20/T34TGN_post.tif": post,
    })
    db = FakeDb()

    result = process_message(task_message(), s3, db)

    assert "processed-products/dnbr/42/2026-07-01_2026-07-20.tif" in s3.uploaded
    assert result["raster_path"] == "processed-products/dnbr/42/2026-07-01_2026-07-20.tif"
    assert result["burned_hectares"] > 0
    assert db.commits == 1


def test_analysis_without_a_fire_gets_its_own_folder(tmp_path):
    """Без fire_id ключът не бива да съдържа 'None' или празно място."""
    pre = write_scene(tmp_path / "pre.tif", *HEALTHY)
    post = write_scene(tmp_path / "post.tif", *BURNT)
    s3 = FakeS3({
        "sentinel2/2026-07-01/T34TGN_pre.tif": pre,
        "sentinel2/2026-07-20/T34TGN_post.tif": post,
    })

    process_message(task_message(fire_id=None), s3, FakeDb())
    (key,) = s3.uploaded
    assert key == "processed-products/dnbr/unassigned/2026-07-01_2026-07-20.tif"


def test_oversized_scene_is_rejected_instead_of_eating_the_container(tmp_path, monkeypatch):
    """Прекалено голяма сцена → ясна грешка (→ DLQ), а не OOM и цикъл от рестарти."""
    import worker

    monkeypatch.setattr(worker, "MAX_MEGAPIXELS", 0.00001)  # 10 пиксела
    pre = write_scene(tmp_path / "pre.tif", *HEALTHY)
    post = write_scene(tmp_path / "post.tif", *BURNT)

    with pytest.raises(ValueError, match="MP"):
        analyse(pre, post, ["B08", "B12"])
