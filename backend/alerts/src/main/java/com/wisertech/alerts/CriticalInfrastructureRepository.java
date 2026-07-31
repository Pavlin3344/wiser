package com.wisertech.alerts;

import java.util.List;

import org.locationtech.jts.geom.Point;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CriticalInfrastructureRepository extends JpaRepository<CriticalInfrastructure, Long> {
    // Native query because the geometry->geography cast (::geography) needed for a real-world
    // meters distance is a plain SQL cast, not a callable function JPQL's function() escape can express.
    @Query(value = "SELECT * FROM critical_infrastructure c "
            + "WHERE ST_DWithin(c.geom::geography, CAST(:point AS geography), :meters)", nativeQuery = true)
    List<CriticalInfrastructure> findWithinDistance(@Param("point") Point point, @Param("meters") double meters);
}
