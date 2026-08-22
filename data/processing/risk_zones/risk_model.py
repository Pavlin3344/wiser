"""Риск модел (MVP) — виж shared/schemas/message-contracts.md раздел 7.

risk_class = clamp( fwi_class + ndvi_корекция + fuel_корекция , 1, 6 )
"""

# NFFL fire behavior модели (Anderson 1982) — EFFIS European Fuel Map.
# 0 = няма горивен модел; 1-10 = горивни.
_NFFL_HIGH = {3, 4, 10}   # висока трева, чапарал, timber + understory (ladder fuels)
_NFFL_LOW = {1, 9}        # къса трева, hardwood litter (ниско разпространение)


def fuel_correction(fuel_code):
    """Корекция по NFFL код.

    Код 0 НЕ занулява риска. EFFIS дава горивен модел само на дива растителност, така
    че 0 покрива и вода, и град, и **земеделска земя** — а тя е ~47% от България и
    стърнищата са водещият тип пожар тук. Докато правилото форсираше клас 1, 975 от
    1787 клетки излизаха „нисък риск", 883 от тях при FWI клас 3+; проверка срещу
    живия feed показа, че **76% от активните детекции** падат точно в тези клетки.
    Ранно предупреждение, което мълчи, е по-лошо от липсващо.

    Занулява се само това, за което имаме отделно доказателство (вода/град) — това
    още не е вързано, затова тук няма форсиране.
    """
    if fuel_code is None:     # няма fuel данни за точката → без корекция
        return 0
    if fuel_code in _NFFL_HIGH:
        return 1
    if fuel_code in _NFFL_LOW:
        return -1
    return 0                  # 0 (без модел) и умерените модели (2, 5, 6, 7, 8)


def ndvi_correction(ndvi_mean):
    if ndvi_mean is None:
        return 0
    if 0.2 <= ndvi_mean < 0.4:   # сух стрес → по-запалимо
        return 1
    if ndvi_mean > 0.6:          # сочна, влажна растителност
        return -1
    return 0


def risk_class(fwi_class: int, ndvi_mean, fuel_type) -> int:
    raw = fwi_class + ndvi_correction(ndvi_mean) + fuel_correction(fuel_type)
    return max(1, min(6, raw))


def risk_score(fwi_class: int, ndvi_mean, fuel_type) -> float:
    """Непрекъсната стойност 0..1 (за сортиране/прозрачност)."""
    return risk_class(fwi_class, ndvi_mean, fuel_type) / 6.0
