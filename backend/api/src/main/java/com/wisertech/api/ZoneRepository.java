package com.wisertech.api;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ZoneRepository extends JpaRepository<Zone, Integer> {

    /**
     * Only the most recently computed day.
     *
     * The batch rebuilds the zones once per valid_date and keeps a few days of history,
     * so findAll() would hand the map several overlapping copies of the whole country -
     * megabytes of polygons - where only the latest picture is meant to be drawn.
     */
    @Query("SELECT z FROM Zone z WHERE z.validDate = (SELECT MAX(latest.validDate) FROM Zone latest)")
    List<Zone> findLatest();
}
