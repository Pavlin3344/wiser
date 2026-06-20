"""Риск модел (MVP) — виж shared/schemas/message-contracts.md раздел 7.

risk_class = clamp( fwi_class + ndvi_корекция + fuel_корекция , 1, 6 )
град / вода / nonfuel → насила risk_class = 1.
"""

# FirEUrisk fuel кодове (виж презентацията, стр. 7)
_NEEDLELEAF_MIXED = {1211, 1212, 1221, 1222, 1301, 1302}
_CROPLAND = {41, 42}
_NONFUEL = {7, 61, 62}  # nonfuel + урбанизирано (вода ~ липсва код / None)


def fuel_correction(fuel_type):
    """Връща корекцията, или None ако зоната е nonfuel (→ насила клас 1)."""
    if fuel_type is None or fuel_type in _NONFUEL:
        return None
    if fuel_type in _NEEDLELEAF_MIXED:
        return 1
    if fuel_type in _CROPLAND:
        return -1
    return 0  # широколистни, храсти, треви, wet/peat


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
