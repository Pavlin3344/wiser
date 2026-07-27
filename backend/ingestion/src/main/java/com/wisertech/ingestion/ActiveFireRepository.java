package com.wisertech.ingestion;

import java.time.Instant;

import org.locationtech.jts.geom.Point;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ActiveFireRepository extends JpaRepository<ActiveFire, Long> {
    @Query("SELECT COUNT(f) > 0 FROM ActiveFire f "
            + "WHERE f.source = :source AND f.detectedAt = :detectedAt "
            + "AND function('ST_Equals', f.geom, :geom) = true")
    boolean existsDuplicate(@Param("source") String source, @Param("detectedAt") Instant detectedAt, @Param("geom") Point geom);
}
