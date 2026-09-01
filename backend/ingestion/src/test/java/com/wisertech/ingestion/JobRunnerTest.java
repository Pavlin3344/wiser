package com.wisertech.ingestion;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

// The routing this covers is the whole reason a scheduled job on Azure now finishes
// instead of timing out, and it is the kind of thing a typo breaks silently: a job named
// for one feed quietly running another still exits 0 and still looks green.
class JobRunnerTest {

    private final EffisDownloaderService effis = mock(EffisDownloaderService.class);
    private final FireIngestionService fires = mock(FireIngestionService.class);
    private final AirQualityService airQuality = mock(AirQualityService.class);
    private final SentinelFetcherService sentinel = mock(SentinelFetcherService.class);
    private final OsmImportService osm = mock(OsmImportService.class);

    private JobRunner runnerFor(String job) {
        return new JobRunner(effis, fires, airQuality, sentinel, osm, job);
    }

    @Test
    void runsOnlyTheEffisFeed() throws Exception {
        runnerFor("effis").run(null);

        verify(effis).fetchLatest();
        verifyNoInteractions(fires, airQuality, sentinel, osm);
    }

    @Test
    void runsOnlyTheFirmsFeed() throws Exception {
        runnerFor("firms").run(null);

        verify(fires).ingestLatest();
        verifyNoInteractions(effis, airQuality, sentinel, osm);
    }

    @Test
    void runsOnlyTheAirQualityFeed() throws Exception {
        runnerFor("air-quality").run(null);

        verify(airQuality).fetchLatest();
        verifyNoInteractions(effis, fires, sentinel, osm);
    }

    @Test
    void runsOnlyTheSentinelFeed() throws Exception {
        runnerFor("sentinel").run(null);

        verify(sentinel).fetchLatest();
        verifyNoInteractions(effis, fires, airQuality, osm);
    }

    // scheduledImport(), not importCriticalInfrastructure(): the osm.import.scheduled flag
    // still decides whether a country-wide Overpass query actually runs. Moving the timer
    // into the platform's cron must not quietly turn that on.
    @Test
    void osmGoesThroughTheGuardedEntryPoint() throws Exception {
        runnerFor("osm").run(null);

        verify(osm).scheduledImport();
        verifyNoInteractions(effis, fires, airQuality, sentinel);
    }

    // A bad WISER_JOB has to fail loudly. Exiting 0 having done nothing would report a
    // healthy run for a feed that never happened - exactly the failure mode this whole
    // change exists to remove.
    @ParameterizedTest
    @ValueSource(strings = {"", "EFFIS", "fwi", "air_quality", "alerts"})
    void unknownJobNameFails(String job) {
        assertThatThrownBy(() -> runnerFor(job).run(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining(job.isEmpty() ? "Unknown WISER_JOB" : job);

        verifyNoInteractions(effis, fires, airQuality, sentinel, osm);
    }

    // The names are a contract with modules/container-apps/variables.tf, which sets
    // WISER_JOB per scheduled job. They cannot drift apart without a job silently failing
    // every night, so pin them here rather than leaving them implied by the switch.
    @Test
    void acceptsExactlyTheNamesTerraformSets() {
        List<String> supported = List.of("effis", "firms", "air-quality", "sentinel", "osm");

        assertThat(supported).allSatisfy(job ->
                assertThatCode(() -> runnerFor(job).run(null)).doesNotThrowAnyException());
    }
}
