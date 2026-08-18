"""Тестове на риск модела — контрактът е в shared/schemas/message-contracts.md раздел 7.

Целта не е покритие заради покритието, а точките, на които се спори при ревю:
границите на NDVI корекцията, кои NFFL кодове качват/свалят класа, и правилото че
негоримото никога не свети червено.
"""
import pytest

from risk_model import fuel_correction, ndvi_correction, risk_class, risk_score

MODERATE_FUEL = 2  # без корекция — за да не мърда fuel-ът, когато тестваме NDVI


@pytest.mark.parametrize(
    "ndvi, expected",
    [
        (None, 0),      # няма NDVI растер за тази точка
        (0.19, 0),      # под сухия диапазон (гола почва / вода / изгоряло)
        (0.2, 1),       # долна граница на сухия стрес — включена
        (0.39, 1),
        (0.4, 0),       # горна граница на сухия стрес — изключена
        (0.6, 0),       # 0.6 точно е още "умерена", не "сочна"
        (0.61, -1),
        (0.95, -1),
    ],
)
def test_ndvi_correction_boundaries(ndvi, expected):
    assert ndvi_correction(ndvi) == expected


@pytest.mark.parametrize(
    "code, expected",
    [
        (0, None),      # негоримо — сигнал за "насила клас 1", не число
        (None, 0),      # извън покритието на fuel картата
        (1, -1),        # къса трева
        (9, -1),        # hardwood litter
        (3, 1),         # висока трева
        (4, 1),         # чапарал
        (10, 1),        # timber + подлес (ladder fuels)
        (2, 0),
        (5, 0),
        (6, 0),
        (7, 0),
        (8, 0),
    ],
)
def test_fuel_correction_per_nffl_code(code, expected):
    assert fuel_correction(code) == expected


def test_nonfuel_forces_class_one():
    """Правилото за доверие: град/вода/гола почва не светят червено при никакъв FWI."""
    for fwi in range(1, 7):
        assert risk_class(fwi, 0.25, 0) == 1


def test_clamped_at_six():
    """Максимален FWI + сух стрес + високо гориво не може да излезе над 6."""
    assert risk_class(6, 0.3, 3) == 6


def test_clamped_at_one():
    """Минимален FWI + сочна растителност + ниско гориво не може да падне под 1."""
    assert risk_class(1, 0.8, 1) == 1


def test_corrections_stack():
    """Двете корекции се събират, не се изключват една друга."""
    assert risk_class(3, 0.3, 3) == 5    # +1 NDVI, +1 fuel
    assert risk_class(3, 0.8, 1) == 1    # -1 NDVI, -1 fuel
    assert risk_class(3, 0.5, MODERATE_FUEL) == 3  # без корекции


def test_missing_inputs_fall_back_to_fwi_alone():
    """Без NDVI и без fuel рискът е самият FWI клас — не се вдига и не се сваля."""
    for fwi in range(1, 7):
        assert risk_class(fwi, None, None) == fwi


def test_risk_score_tracks_class():
    assert risk_score(6, None, MODERATE_FUEL) == 1.0
    assert risk_score(3, None, MODERATE_FUEL) == pytest.approx(0.5)
    assert risk_score(1, 0.25, 0) == pytest.approx(1 / 6)  # негоримо → score на клас 1
