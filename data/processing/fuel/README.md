# Fuel map loader (Фаза 1)

Еднократно зарежда **EFFIS European Fuel Map** (Copernicus EMS), изрязана за България,
в MinIO `processed-products/fuel/bg_fuel.tif`. Risk zones job-ът я семплира оттам.

## Класификация — NFFL fire behavior модели (Anderson 1982)

| код | модел | група | риск корекция |
|---|---|---|:-:|
| 0 | негоримо (вода/град/гола почва) | — | → насила клас 1 |
| 1 | къса трева | треви | −1 |
| 2 | timber (трева + подлес) | треви | 0 |
| 3 | висока трева | треви | +1 |
| 4 | чапарал | храсти | +1 |
| 5 | храсти (~0.6 m) | храсти | 0 |
| 6 | сухи храсти / hardwood slash | храсти | 0 |
| 7 | southern rough | храсти | 0 |
| 8 | closed timber litter | горска постеля | 0 |
| 9 | hardwood litter | горска постеля | −1 |
| 10 | timber (постеля + подлес) | горска постеля | +1 |

Корекциите се прилагат в [`../risk_zones/risk_model.py`](../risk_zones/risk_model.py).

## Пускане (Python 3.11)

```bash
cd data/processing/fuel
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python load_fuel.py
```

## Бележки
- Източник: <https://forest-fire.emergency.copernicus.eu/applications/data-and-services> (Fuels).
- EFFIS дава само **един европейски** файл; скриптът изрязва само България и качва само нея.
- ⚠️ EFFIS сървърът има **изтекъл SSL сертификат** — затова свалянето пропуска cert проверката.
  Това е техен проблем; файлът е публичен държавен dataset.
- Статични данни — пуска се веднъж (или при нова версия на картата).
