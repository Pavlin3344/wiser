"""Тестове на dNBR сметката — праговете, площите и празните пиксели.

Числата тук са това, което после излиза като „толкова хектара са изгорели", така че
границите между класовете и площта на пиксела се проверяват поименно.
"""
import numpy as np
import pytest
from rasterio.transform import from_bounds

from burn_severity import (
    BURNED_CLASSES,
    CLASS_NAMES,
    classify,
    delta_nbr,
    mean_dnbr,
    normalized_burn_ratio,
    row_pixel_hectares,
    severity_stats,
)


def test_nbr_formula():
    """NBR = (NIR - SWIR2) / (NIR + SWIR2)."""
    nir = np.array([[3000.0]])
    swir = np.array([[1000.0]])
    assert normalized_burn_ratio(nir, swir) == pytest.approx(0.5)


def test_healthy_vegetation_scores_higher_than_burnt_ground():
    """Жива растителност: висок NIR, нисък SWIR. Изгоряло: обратното."""
    healthy = normalized_burn_ratio(np.array([[4000.0]]), np.array([[800.0]]))
    burnt = normalized_burn_ratio(np.array([[1200.0]]), np.array([[2500.0]]))
    assert healthy > 0 > burnt


@pytest.mark.filterwarnings("error::RuntimeWarning")
def test_empty_pixels_become_nan_not_zero():
    """0/0 → NaN.

    Нулата тук значи „без промяна", тоест незасегнато. Празен пиксел, записан като нула,
    би влязъл в отчета като незасегната площ, вместо да отпадне.
    """
    result = normalized_burn_ratio(np.array([[0.0, 3000.0]]), np.array([[0.0, 1000.0]]))
    assert np.isnan(result[0][0])
    assert result[0][1] == pytest.approx(0.5)


def test_delta_is_pre_minus_post():
    """Изгарянето сваля NBR, значи dNBR излиза положително."""
    pre = np.array([[0.6]], dtype="float32")
    post = np.array([[-0.1]], dtype="float32")
    assert delta_nbr(pre, post) == pytest.approx(0.7)


def test_mismatched_scenes_are_rejected():
    """Различни размери → ясна грешка, а не мълчаливо сравняване на различни места."""
    with pytest.raises(ValueError, match="различен размер"):
        delta_nbr(np.zeros((4, 4), dtype="float32"), np.zeros((4, 5), dtype="float32"))


@pytest.mark.parametrize(
    "value, expected, label",
    [
        (-0.5, 1, "силно възстановяване"),
        (-0.11, 1, "точно под прага за възстановяване"),
        (-0.10, 2, "долната граница на 'без промяна' е включена"),
        (0.0, 2, "без промяна"),
        (0.09, 2, "точно под ниска степен"),
        (0.10, 3, "ниска степен започва"),
        (0.26, 3, ""),
        (0.27, 4, "умерено-ниска започва"),
        (0.43, 4, ""),
        (0.44, 5, "умерено-висока започва"),
        (0.65, 5, ""),
        (0.66, 6, "висока започва"),
        (1.3, 6, "максимално изгаряне"),
    ],
)
def test_class_boundaries(value, expected, label):
    assert classify(np.array([[value]], dtype="float32"))[0][0] == expected, label


def test_nodata_pixels_get_class_zero():
    classes = classify(np.array([[np.nan, 0.5]], dtype="float32"))
    assert classes[0][0] == 0
    assert classes[0][1] == 5


def test_burned_classes_are_the_damaged_ones():
    """Възстановяване и без промяна не са щета — иначе всяка гора би излизала 'изгоряла'."""
    assert BURNED_CLASSES == (3, 4, 5, 6)
    assert [CLASS_NAMES[c] for c in BURNED_CLASSES] == ["low", "moderate_low", "moderate_high", "high"]


def test_pixel_area_shrinks_towards_the_north():
    """Градус дължина покрива по-малко земя на север, значи и пикселът е по-малък.

    Една стойност за целия растер надценява площта горе — точно това число после се
    чете като 'изгорели декари'.
    """
    transform = from_bounds(23.0, 41.0, 24.0, 44.0, 10, 300)
    hectares = row_pixel_hectares(transform, height=300, geographic=True)
    assert hectares[0] < hectares[-1]          # първият ред е най-северният
    assert hectares[0] / hectares[-1] == pytest.approx(np.cos(np.radians(44)) / np.cos(np.radians(41)), rel=1e-3)


def test_pixel_area_is_constant_in_a_projected_raster():
    """При метрична проекция площта не зависи от реда."""
    transform = from_bounds(0, 0, 1000, 1000, 10, 10)  # 100 m пиксел
    hectares = row_pixel_hectares(transform, height=10, geographic=False)
    assert hectares == pytest.approx(np.full(10, 1.0))  # 100 m × 100 m = 1 ha


def test_pixel_area_matches_a_known_size():
    """Проверка срещу сметнато на ръка: ~0.5° × 0.4° поле на 42.6°N."""
    transform = from_bounds(25.0, 42.4, 25.5, 42.8, 1, 1)
    (hectares,) = row_pixel_hectares(transform, height=1, geographic=True)
    expected = (0.4 * 111_320) * (0.5 * 111_320 * np.cos(np.radians(42.6))) / 10_000
    assert hectares == pytest.approx(expected)


def test_severity_stats_sum_up():
    """Хектарите по класове се събират до анализираната площ, без празните пиксели."""
    classes = np.array([[0, 3], [5, 6]], dtype="uint8")
    row_hectares = np.array([2.0, 2.0])

    stats = severity_stats(classes, row_hectares)
    assert stats["per_class"]["low"] == pytest.approx(2.0)
    assert stats["per_class"]["moderate_high"] == pytest.approx(2.0)
    assert stats["per_class"]["high"] == pytest.approx(2.0)
    assert stats["burned_hectares"] == pytest.approx(6.0)
    assert stats["analysed_hectares"] == pytest.approx(6.0)   # празният пиксел не се брои


def test_severity_stats_use_each_rows_own_area():
    """Редовете имат различна площ и това трябва да се вижда в сбора."""
    classes = np.array([[6], [6]], dtype="uint8")
    stats = severity_stats(classes, np.array([1.0, 3.0]))
    assert stats["burned_hectares"] == pytest.approx(4.0)


def test_mean_ignores_nodata():
    assert mean_dnbr(np.array([[np.nan, 0.2, 0.4]], dtype="float32")) == pytest.approx(0.3)


def test_mean_of_empty_scene_is_none():
    """Изцяло празен растер → None, а не NaN, за да влезе в базата като NULL."""
    assert mean_dnbr(np.array([[np.nan]], dtype="float32")) is None
