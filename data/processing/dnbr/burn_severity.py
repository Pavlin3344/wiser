"""dNBR и класове на изгаряне — Фаза 3.

Чиста сметка, без мрежа и без база, за да е тествана отделно от worker-а.

**NBR** (Normalized Burn Ratio) = (NIR − SWIR2) / (NIR + SWIR2), от Sentinel-2 канали
B08 и B12. Живата растителност отразява силно в NIR и слабо в SWIR2; изгорялата почва
прави обратното, затова разликата преди/след пожара мери щетата:

    dNBR = NBR_преди − NBR_след

Праговете са стандартните на USGS (Key & Benson 2006), а класовете са 1–6 — същата
скала като `fwi_class` и `risk_class` другаде в проекта, за да не се въвежда трета
конвенция.
"""
import numpy as np

# Метри на градус ширина. За дължина се умножава по cos(ширина).
METERS_PER_DEGREE = 111_320.0
SQUARE_METERS_PER_HECTARE = 10_000.0

# Горна граница на класа (включително) → код. Последният клас е всичко над 0.66.
_THRESHOLDS = [(-0.10, 1), (0.10, 2), (0.27, 3), (0.44, 4), (0.66, 5)]
HIGHEST_CLASS = 6

CLASS_NAMES = {
    1: "regrowth",       # dNBR < -0.10 — по-зелено отпреди (възстановяване)
    2: "unburned",       # -0.10 … 0.10 — без промяна
    3: "low",            # 0.10 … 0.27
    4: "moderate_low",   # 0.27 … 0.44
    5: "moderate_high",  # 0.44 … 0.66
    6: "high",           # > 0.66
}

# Класове, които се броят за „изгоряло" в обобщението. 1 и 2 не са щета.
BURNED_CLASSES = (3, 4, 5, 6)

NODATA_CLASS = 0


def normalized_burn_ratio(nir, swir):
    """NBR по двойка канали. Празните пиксели стават NaN, не нула.

    Тук нулата е истинска стойност („без промяна"), затова 0/0 не бива да се изражда в
    нея — NaN изпада от статистиките, вместо да ги разрежда с фалшиво незасегната площ.
    """
    nir = nir.astype("float32")
    swir = swir.astype("float32")
    denom = nir + swir
    return np.divide(
        nir - swir, denom,
        out=np.full(denom.shape, np.nan, dtype="float32"),
        where=denom != 0,
    )


def delta_nbr(pre_nbr, post_nbr):
    """dNBR = преди − след. NaN от която и да е сцена се пренася нататък."""
    if pre_nbr.shape != post_nbr.shape:
        raise ValueError(
            f"Сцените преди и след са с различен размер: {pre_nbr.shape} и {post_nbr.shape}"
        )
    return (pre_nbr - post_nbr).astype("float32")


def classify(dnbr):
    """dNBR → класове 1–6 (0 = няма данни)."""
    classes = np.full(dnbr.shape, NODATA_CLASS, dtype="uint8")
    valid = ~np.isnan(dnbr)

    remaining = valid.copy()
    for upper, code in _THRESHOLDS:
        in_class = remaining & (dnbr < upper)
        classes[in_class] = code
        remaining &= ~in_class
    classes[remaining] = HIGHEST_CLASS
    return classes


def row_pixel_hectares(transform, height, geographic):
    """Площ на пиксел в хектари, поотделно за всеки ред на растера.

    При географски координати пикселът не е с постоянна площ: градус дължина се смалява
    на север. Една стойност за целия растер надценява площта в горния му край, а точно
    тази площ отива в отчета „колко декара са изгорели".
    """
    width_deg = abs(transform.a)
    height_deg = abs(transform.e)

    if not geographic:  # проектирана система — единиците вече са метри
        return np.full(height, width_deg * height_deg / SQUARE_METERS_PER_HECTARE)

    row_centers = np.arange(height) + 0.5
    latitudes = transform.f + row_centers * transform.e
    meters_lat = height_deg * METERS_PER_DEGREE
    meters_lon = width_deg * METERS_PER_DEGREE * np.cos(np.radians(latitudes))
    return meters_lat * meters_lon / SQUARE_METERS_PER_HECTARE


def severity_stats(classes, row_hectares):
    """Хектари по клас + общо изгоряло + дял на пикселите с данни."""
    areas = np.broadcast_to(row_hectares[:, None], classes.shape)

    per_class = {
        name: float(areas[classes == code].sum())
        for code, name in CLASS_NAMES.items()
    }
    burned = float(sum(per_class[CLASS_NAMES[code]] for code in BURNED_CLASSES))
    analysed = float(areas[classes != NODATA_CLASS].sum())
    return {"per_class": per_class, "burned_hectares": burned, "analysed_hectares": analysed}


def mean_dnbr(dnbr):
    """Средно dNBR само по пикселите с данни; None ако няма нито един."""
    valid = dnbr[~np.isnan(dnbr)]
    return float(valid.mean()) if valid.size else None
