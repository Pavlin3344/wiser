"""Риск модел (MVP) — виж shared/schemas/message-contracts.md раздел 7.

risk_class = clamp( fwi_class + ndvi_корекция + fuel_корекция , 1, 6 )
град / вода / nonfuel → насила risk_class = 1.
"""

# NFFL fire behavior модели (Anderson 1982) — EFFIS European Fuel Map.
# 0 = негоримо (вода/град/гола почва); 1-10 = горивни модели.
_NFFL_HIGH = {3, 4, 10}   # висока трева, чапарал, timber + understory (ladder fuels)
_NFFL_LOW = {1, 9}        # къса трева, hardwood litter (ниско разпространение)


def fuel_correction(fuel_code):
    """Корекция по NFFL код. None → насила клас 1 (негоримо)."""
    if fuel_code == 0:        # негоримо
        return None
    if fuel_code is None:     # няма fuel данни за точката → без корекция
        return 0
    if fuel_code in _NFFL_HIGH:
        return 1
    if fuel_code in _NFFL_LOW:
        return -1
    return 0                  # умерени модели (2, 5, 6, 7, 8)


def ndvi_correction(ndvi_mean):
    if ndvi_mean is None:
        return 0
    if 0.2 <= ndvi_mean < 0.4:   # сух стрес → по-запалимо
        return 1
    if ndvi_mean > 0.6:          # сочна, влажна растителност
        return -1
    return 0


def risk_class(fwi_class: int, ndvi_mean, fuel_type) -> int:
    fc = fuel_correction(fuel_type)
    if fc is None:               # nonfuel / град / вода
        return 1
    raw = fwi_class + ndvi_correction(ndvi_mean) + fc
    return max(1, min(6, raw))


def risk_score(fwi_class: int, ndvi_mean, fuel_type) -> float:
    """Непрекъсната стойност 0..1 (за сортиране/прозрачност)."""
    return risk_class(fwi_class, ndvi_mean, fuel_type) / 6.0
