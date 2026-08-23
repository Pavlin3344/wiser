"""Тестове на producer-а за `analysis.tasks` — избор на сцени, прозорци и размери.

Без мрежа, без MinIO и без база: каталогът се подменя, а растерите се пишат във временна
папка. Тестват се решенията, които се взимат преди да е свалено каквото и да е — те са и
единственото, което може да мълчи вместо да гръмне.
"""
from datetime import date

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_bounds

import fetch_scene_pair as producer
from fetch_scene_pair import (
    MAX_DIMENSION,
    MAX_MEGAPIXELS,
    Target,
    data_coverage,
    pick_acquisition,
    raster_size,
    scene_windows,
)

BBOX = (25.60, 41.80, 25.80, 41.95)


def catalog_response(days_and_clouds):
    """Отговор на каталога: [(дата, облачност), ...] → STAC features."""
    return {
        "features": [
            {"properties": {"datetime": f"{day}T09:12:34Z", "eo:cloud_cover": cloud}}
            for day, cloud in days_and_clouds
        ]
    }


@pytest.fixture
def catalog(monkeypatch):
    """Подменя единствената мрежова функция и връща каквото тестът зададе."""
    box = {}

    def use(days_and_clouds):
        import json

        box["body"] = json.dumps(catalog_response(days_and_clouds)).encode()

    def fake_post_json(url, body, token, timeout=90):
        return box["body"]

    monkeypatch.setattr(producer, "_post_json", fake_post_json)
    return use


# --- Избор на сцена ---------------------------------------------------------------


def test_picks_the_scene_closest_to_the_fire(catalog):
    """Близостта до пожара е водеща — по-чиста, но по-далечна сцена мери и растеж."""
    catalog([("2026-07-28", 0.0), ("2026-08-09", 12.6)])

    day, cloud = pick_acquisition(
        "token", BBOX, (date(2026, 7, 28), date(2026, 8, 9)),
        max_cloud=20.0, anchor=date(2026, 8, 10),
    )

    assert day == date(2026, 8, 9)
    assert cloud == pytest.approx(12.6)


def test_cloudy_days_are_skipped_even_when_closest(catalog):
    catalog([("2026-08-02", 5.0), ("2026-08-09", 88.0)])

    day, _ = pick_acquisition(
        "token", BBOX, (date(2026, 8, 1), date(2026, 8, 9)),
        max_cloud=20.0, anchor=date(2026, 8, 10),
    )

    assert day == date(2026, 8, 2)


def test_day_takes_the_worst_cloud_of_its_tiles(catalog):
    """Композитът за деня ползва всички плочки, значи важи най-лошата, не средната."""
    catalog([("2026-08-09", 3.0), ("2026-08-09", 71.0), ("2026-08-02", 9.0)])

    day, cloud = pick_acquisition(
        "token", BBOX, (date(2026, 8, 1), date(2026, 8, 9)),
        max_cloud=20.0, anchor=date(2026, 8, 10),
    )

    assert day == date(2026, 8, 2)
    assert cloud == pytest.approx(9.0)


def test_no_clear_day_says_how_close_it_got(catalog):
    """Съобщението трябва да води до следващото действие, не само да откаже."""
    catalog([("2026-08-02", 44.0), ("2026-08-09", 61.0)])

    with pytest.raises(LookupError, match="2026-08-02"):
        pick_acquisition(
            "token", BBOX, (date(2026, 8, 1), date(2026, 8, 9)),
            max_cloud=20.0, anchor=date(2026, 8, 10),
        )


def test_empty_catalog_is_an_error_not_an_empty_pick(catalog):
    catalog([])

    with pytest.raises(LookupError):
        pick_acquisition(
            "token", BBOX, (date(2026, 8, 1), date(2026, 8, 9)),
            max_cloud=20.0, anchor=date(2026, 8, 10),
        )


# --- Прозорци ---------------------------------------------------------------------


def test_windows_avoid_the_burn_itself():
    """Сцената „преди" е отпреди първата детекция, „след" — след като димът се разнесе."""
    target = Target(BBOX, fire_id=7, first_seen=date(2026, 8, 10), last_seen=date(2026, 8, 13))

    (pre_from, pre_to), (post_from, post_to) = scene_windows(
        target, None, None, window_days=12, smoke_days=3,
    )

    assert pre_to == date(2026, 8, 9)
    assert pre_from == date(2026, 7, 28)
    assert post_from == date(2026, 8, 16)
    assert post_to == date(2026, 8, 28)


def test_explicit_dates_get_a_window_around_them():
    """Точната дата рядко съвпада с прелитане, затова се търси в прозорец около нея."""
    target = Target(BBOX, fire_id=None, first_seen=None, last_seen=None)

    (pre_from, pre_to), (post_from, post_to) = scene_windows(
        target, date(2026, 8, 8), date(2026, 8, 22), window_days=10, smoke_days=3,
    )

    assert (pre_from, pre_to) == (date(2026, 7, 29), date(2026, 8, 8))
    assert (post_from, post_to) == (date(2026, 8, 22), date(2026, 9, 1))


def test_manual_bbox_without_dates_is_refused():
    target = Target(BBOX, fire_id=None, first_seen=None, last_seen=None)

    with pytest.raises(ValueError):
        scene_windows(target, None, None, window_days=12, smoke_days=3)


# --- Размер на растера ------------------------------------------------------------


def test_requested_resolution_is_kept_when_it_fits():
    width, height, metres = raster_size(BBOX, 20.0)

    assert metres == 20.0
    assert width == pytest.approx(826, abs=5)   # 0.20° дължина на 41.9° ш.
    assert height == pytest.approx(835, abs=5)  # 0.15° ширина


def test_large_area_relaxes_the_resolution_instead_of_failing():
    """Worker-ът отказва сцена над 20 MP, а Process API — над 2500 пиксела на страна.

    Голямо пожарище иначе би гръмнало чак след минута чакане на отговор.
    """
    huge = (22.3, 41.2, 28.7, 44.2)  # цяла България

    width, height, metres = raster_size(huge, 20.0)

    assert metres > 20.0
    assert max(width, height) <= MAX_DIMENSION
    assert width * height / 1e6 <= MAX_MEGAPIXELS


# --- Покритие на кадъра -----------------------------------------------------------


def write_scene(path, filled_rows, size=8):
    profile = {
        "driver": "GTiff", "width": size, "height": size, "count": 2,
        "dtype": "float32", "crs": "EPSG:4326",
        "transform": from_bounds(*BBOX, size, size),
    }
    nir = np.zeros((size, size), dtype="float32")
    swir = np.zeros((size, size), dtype="float32")
    nir[:filled_rows, :] = 3000.0
    swir[:filled_rows, :] = 1200.0
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(nir, 1)
        dst.write(swir, 2)
    return path.read_bytes()


def test_empty_response_reads_as_no_coverage(tmp_path):
    """Празен отговор от Copernicus е черен кадър, не грешка — иначе минава нататък."""
    tiff = write_scene(tmp_path / "empty.tif", filled_rows=0)

    assert data_coverage(tiff) == 0.0


def test_partial_coverage_is_measured(tmp_path):
    tiff = write_scene(tmp_path / "half.tif", filled_rows=4)

    assert data_coverage(tiff) == pytest.approx(0.5)


# --- Имена ------------------------------------------------------------------------


def test_label_names_the_fire_when_there_is_one():
    assert Target(BBOX, fire_id=19215, first_seen=None, last_seen=None).label == "fire-19215"


def test_label_falls_back_to_the_box():
    """Обхватът не е плочка на Sentinel, затова ключът не бива да прилича на T-код."""
    label = Target(BBOX, fire_id=None, first_seen=None, last_seen=None).label

    assert label == "bbox-25.60_41.80_25.80_41.95"
