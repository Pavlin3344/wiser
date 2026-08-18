"""Тестове на NDVI сметката.

Пише се истински двуканален GeoTIFF във временна папка и се чете обратно — rasterio е
половината от логиката тук (кой канал е кой), а mock на rasterio би тествал само мока.
"""
import numpy as np
import pytest
import rasterio

from worker import compute_ndvi


def write_scene(path, red, nir, band_order=("B04", "B08")):
    """Сцена с два канала. `band_order` казва кой канал е записан първи във файла."""
    first, second = (red, nir) if band_order[0] == "B04" else (nir, red)
    profile = {
        "driver": "GTiff", "width": first.shape[1], "height": first.shape[0],
        "count": 2, "dtype": "uint16", "crs": "EPSG:4326",
        "transform": rasterio.transform.from_bounds(25.0, 42.4, 25.5, 42.8,
                                                    first.shape[1], first.shape[0]),
    }
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(first.astype("uint16"), 1)
        dst.write(second.astype("uint16"), 2)
    return str(path)


def test_computes_ndvi_formula(tmp_path):
    """NDVI = (NIR - Red) / (NIR + Red)."""
    red = np.full((4, 4), 1000)
    nir = np.full((4, 4), 3000)
    ndvi, _ = compute_ndvi(write_scene(tmp_path / "scene.tif", red, nir), ["B04", "B08"])
    assert ndvi == pytest.approx(0.5)


def test_band_order_comes_from_the_message(tmp_path):
    """Ако fetcher-ът запише каналите наобратно, `bands` в съобщението го казва.

    Иначе NDVI излиза с обърнат знак — здрава гора се отчита като гола почва.
    """
    red = np.full((4, 4), 1000)
    nir = np.full((4, 4), 3000)
    path = write_scene(tmp_path / "scene.tif", red, nir, band_order=("B08", "B04"))
    ndvi, _ = compute_ndvi(path, ["B08", "B04"])
    assert ndvi == pytest.approx(0.5)


@pytest.mark.filterwarnings("error::RuntimeWarning")
def test_no_data_pixels_do_not_divide_by_zero(tmp_path):
    """Празен пиксел (0 и в двата канала) → 0.0, не NaN и не срив.

    Warning-ът е вдигнат до грешка: делението на нула не бива дори да се случва, иначе
    всяка сцена с no-data пълни логовете на worker-а.
    """
    red = np.array([[1000, 0], [1000, 0]])
    nir = np.array([[3000, 0], [3000, 0]])
    ndvi, _ = compute_ndvi(write_scene(tmp_path / "scene.tif", red, nir), ["B04", "B08"])
    assert ndvi[0][0] == pytest.approx(0.5)
    assert ndvi[0][1] == 0.0
    assert not np.isnan(ndvi).any()


def test_output_is_a_single_float_band(tmp_path):
    """Продуктът е един канал float32 — risk zones job-ът чете точно него (band 1)."""
    red = np.full((4, 4), 1000)
    nir = np.full((4, 4), 3000)
    ndvi, profile = compute_ndvi(write_scene(tmp_path / "scene.tif", red, nir), ["B04", "B08"])
    assert profile["count"] == 1
    assert profile["dtype"] == "float32"
    assert ndvi.dtype == np.float32
    # геореференцията на входа се пази, иначе семплирането по lon/lat пада
    assert profile["crs"] == rasterio.crs.CRS.from_epsg(4326)


def test_ndvi_stays_in_range(tmp_path):
    """Стойностите винаги са между -1 и 1 — иначе корекциите в риск модела нямат смисъл."""
    rng = np.random.default_rng(42)
    red = rng.integers(0, 10000, size=(16, 16))
    nir = rng.integers(0, 10000, size=(16, 16))
    ndvi, _ = compute_ndvi(write_scene(tmp_path / "scene.tif", red, nir), ["B04", "B08"])
    assert ndvi.min() >= -1.0
    assert ndvi.max() <= 1.0


def test_oversized_scene_is_rejected_instead_of_eating_the_container(tmp_path, monkeypatch):
    """Прекалено голяма сцена → ясна грешка (→ DLQ), а не OOM.

    Убит по OOM контейнер не е потвърдил съобщението: то се връща в опашката, worker-ът
    се вдига, изяжда го пак и така — цикъл, който запушва и всичко зад него.
    """
    import worker

    monkeypatch.setattr(worker, "MAX_MEGAPIXELS", 0.00001)  # 10 пиксела
    path = write_scene(tmp_path / "scene.tif", np.full((4, 4), 1000), np.full((4, 4), 3000))

    with pytest.raises(ValueError, match="MP"):
        compute_ndvi(path, ["B04", "B08"])
