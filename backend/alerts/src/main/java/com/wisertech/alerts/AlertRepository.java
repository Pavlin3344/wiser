package com.wisertech.alerts;

import org.springframework.data.jpa.repository.JpaRepository;

public interface AlertRepository extends JpaRepository<Alert, Long> {
    boolean existsByFireIdAndTargetId(Long fireId, Long targetId);
}
