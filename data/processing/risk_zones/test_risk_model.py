"""Тестове на риск модела — контрактът е в shared/schemas/message-contracts.md раздел 7.

Целта не е покритие заради покритието, а точките, на които се спори при ревю:
границите на NDVI корекцията, кои NFFL кодове качват/свалят класа, и какво прави
моделът, когато fuel картата не дава горивен модел за клетката.
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
        (0, 0),         # няма горивен модел — без корекция, виж теста по-долу
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


def test_code_zero_does_not_silence_the_risk():
    """Код 0 НЕ значи "не гори" и затова не сваля класа.

    Този тест беше обратният: код 0 форсираше клас 1 с довода, че градът, водата и
    голата почва не светят червено. EFFIS обаче дава горивен модел само на дива
    растителност, така че 0 покрива и земеделската земя — ~47% от България, където
    стърнищата са водещият тип пожар.

    Измерено срещу живия feed, а не изведено: 975 от 1787 клетки излизаха "нисък
    риск", 883 от тях при FWI клас 3+, и 76% от активните детекции падаха точно в
    клетки, които картата показваше като зелени.

    Зануляване може да се върне само срещу отделно доказателство за наистина негорима
    повърхност (вода/град). Такъв източник още не е вързан.
    """
    for fwi in range(1, 7):
        assert risk_class(fwi, None, 0) == fwi


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
    # FWI 1 + сух стрес (+1), а код 0 не коригира → клас 2
    assert risk_score(1, 0.25, 0) == pytest.approx(2 / 6)
