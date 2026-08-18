"""Тестове на exporter-а — рендерирането и поведението при паднал източник.

Без база и без MinIO: пробите се подават отвън точно за да са заменими тук.
Смисълът на тези тестове е един: аларма, която лъже, е по-лоша от липсваща аларма.
"""
from datetime import datetime, timezone

import pytest
from prometheus_client import CollectorRegistry, generate_latest

from exporter import DataPipelineCollector, probe_minio, render

JUNE_18 = datetime(2026, 6, 18, 6, 0, tzinfo=timezone.utc)
JUNE_21 = datetime(2026, 6, 21, 6, 0, tzinfo=timezone.utc)


def families(values, ok):
    return {f.name: f for f in render(values, ok)}


def test_scrape_success_has_one_sample_per_source():
    fam = families({}, {"postgres": 1.0, "minio": 0.0})["wiser_data_scrape_success"]
    assert {s.labels["source"]: s.value for s in fam.samples} == {"postgres": 1.0, "minio": 0.0}


def test_timestamps_are_exported_as_epoch_seconds():
    fam = families({"zones_last_computed": 1_781_000_000.0}, {"postgres": 1.0})
    (sample,) = fam["wiser_data_zones_last_computed_timestamp_seconds"].samples
    assert sample.value == 1_781_000_000.0


def test_missing_value_is_omitted_not_zeroed():
    """Празна таблица → метриката липсва.

    Нула би значела 1 януари 1970 — тоест „много старо", което изглежда като истинска
    стойност. Липсващата метрика се хваща с absent() и е отделен, по-честен сигнал.
    """
    names = families({"zones_last_computed": None}, {"postgres": 1.0})
    assert "wiser_data_zones_last_computed_timestamp_seconds" not in names


def test_counts_are_exported_even_when_zero():
    """За броячите нулата е истинска стойност — 0 зони за днес значи точно това."""
    fam = families({"zones_rows_today": 0.0}, {"postgres": 1.0})
    (sample,) = fam["wiser_data_zones_rows_today"].samples
    assert sample.value == 0.0


def test_failing_probe_does_not_hide_the_others():
    """Падналата база не бива да сваля целия scrape, нито да минава за успех."""
    def broken():
        raise RuntimeError("базата не отговаря")

    collector = DataPipelineCollector({
        "postgres": broken,
        "minio": lambda: {"ndvi_product_count": 3.0},
    })
    fams = {f.name: f for f in collector.collect()}

    success = {s.labels["source"]: s.value for s in fams["wiser_data_scrape_success"].samples}
    assert success == {"postgres": 0.0, "minio": 1.0}
    assert fams["wiser_data_ndvi_product_count"].samples[0].value == 3.0


def test_failing_probe_publishes_no_stale_values():
    """При грешка не се публикува нищо от този източник — по-добре липса, отколкото стара стойност."""
    def broken():
        raise RuntimeError("MinIO не отговаря")

    fams = {f.name: f for f in DataPipelineCollector({"minio": broken}).collect()}
    assert set(fams) == {"wiser_data_scrape_success"}


def test_registers_and_renders_as_prometheus_text():
    """Край до край през истински registry — форматът да е валиден, не само обектите."""
    registry = CollectorRegistry()
    registry.register(DataPipelineCollector({
        "postgres": lambda: {"zones_last_computed": 1_781_000_000.0, "zones_rows_today": 2500.0},
    }))
    text = generate_latest(registry).decode()

    assert "wiser_data_zones_last_computed_timestamp_seconds 1.781e+09" in text
    assert 'wiser_data_scrape_success{source="postgres"} 1.0' in text
    assert "# HELP wiser_data_zones_rows_today" in text


class FakeS3:
    """Колкото boto3 клиент ползва probe_minio, и нищо повече."""

    def __init__(self, objects, fuel=True):
        self.objects = objects
        self.fuel = fuel

    def list_objects_v2(self, **_):
        return {"Contents": self.objects} if self.objects else {}

    def head_object(self, **_):
        if not self.fuel:
            raise RuntimeError("NoSuchKey")
        return {}


def test_minio_probe_takes_the_newest_raster():
    s3 = FakeS3([
        {"Key": "ndvi/2026-06-18/T34TGN_ndvi.tif", "LastModified": JUNE_18},
        {"Key": "ndvi/2026-06-21/T34TGN_ndvi.tif", "LastModified": JUNE_21},
    ])
    result = probe_minio(s3)
    assert result["ndvi_last_product"] == JUNE_21.timestamp()
    assert result["ndvi_product_count"] == 2.0
    assert result["fuel_map_present"] == 1.0


def test_minio_probe_ignores_non_raster_keys():
    """В bucket-а има и други неща — само .tif са продукти."""
    s3 = FakeS3([
        {"Key": "ndvi/2026-06-18/T34TGN_ndvi.tif", "LastModified": JUNE_18},
        {"Key": "ndvi/2026-06-21/notes.txt", "LastModified": JUNE_21},
    ])
    result = probe_minio(s3)
    assert result["ndvi_last_product"] == JUNE_18.timestamp()
    assert result["ndvi_product_count"] == 1.0


def test_minio_probe_reports_empty_bucket_as_missing():
    result = probe_minio(FakeS3([]))
    assert result["ndvi_last_product"] is None
    assert result["ndvi_product_count"] == 0.0


def test_missing_fuel_map_is_flagged():
    """Нов MinIO volume без bootstrap → моделът тихо губи fuel корекцията."""
    s3 = FakeS3([{"Key": "ndvi/2026-06-18/x_ndvi.tif", "LastModified": JUNE_18}], fuel=False)
    assert probe_minio(s3)["fuel_map_present"] == 0.0


def test_dnbr_metrics_are_exported():
    """Фаза 3: наблюдава се, но без аларма за давност — анализът е събитиен."""
    fams = families({"dnbr_last_analysis": 1_781_000_000.0, "dnbr_analyses_total": 4.0},
                    {"postgres": 1.0})
    assert fams["wiser_data_dnbr_last_analysis_timestamp_seconds"].samples[0].value == 1_781_000_000.0
    assert fams["wiser_data_dnbr_analyses_total"].samples[0].value == 4.0


def test_dnbr_metrics_absent_before_the_migration_runs():
    """Няма таблица `burn_severity` → пробата не връща тези ключове и метриките липсват."""
    fams = families({"zones_rows_today": 10.0}, {"postgres": 1.0})
    assert "wiser_data_dnbr_analyses_total" not in fams
    assert "wiser_data_zones_rows_today" in fams


@pytest.mark.parametrize("key", ["zones_last_computed", "fwi_last_observation",
                                 "ndvi_last_product", "dnbr_last_analysis"])
def test_every_timestamp_metric_ends_with_the_right_suffix(key):
    """Конвенцията на Prometheus: unix време → _timestamp_seconds, иначе alert-ите заблуждават."""
    (name,) = [f.name for f in render({key: 1.0}, {}) if f.name != "wiser_data_scrape_success"]
    assert name.endswith("_timestamp_seconds")


class PagedS3(FakeS3):
    """S3 връща най-много 1000 ключа на страница — тук две страници по един ключ."""

    def __init__(self, first, second):
        super().__init__(first)
        self.second = second
        self.pages_served = 0

    def list_objects_v2(self, **params):
        self.pages_served += 1
        if "ContinuationToken" not in params:
            return {"Contents": self.objects, "IsTruncated": True, "NextContinuationToken": "page-2"}
        return {"Contents": self.second}


def test_minio_probe_walks_every_page():
    """Най-новият растер може да е на втора страница.

    Без обхождане броят замръзва на 1000, а алармата за стар NDVI гърми при жив pipeline.
    """
    s3 = PagedS3(
        [{"Key": "ndvi/2026-06-18/a_ndvi.tif", "LastModified": JUNE_18}],
        [{"Key": "ndvi/2026-06-21/b_ndvi.tif", "LastModified": JUNE_21}],
    )
    result = probe_minio(s3)
    assert s3.pages_served == 2
    assert result["ndvi_product_count"] == 2.0
    assert result["ndvi_last_product"] == JUNE_21.timestamp()
