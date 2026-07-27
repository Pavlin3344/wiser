package com.wisertech.ingestion;

import org.springframework.data.jpa.repository.JpaRepository;

public interface CriticalInfrastructureRepository extends JpaRepository<CriticalInfrastructure, Long> {
    boolean existsByOsmId(Long osmId);
}
