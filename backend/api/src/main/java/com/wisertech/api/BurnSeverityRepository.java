package com.wisertech.api;

import java.util.List;

import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BurnSeverityRepository extends JpaRepository<BurnSeverity, Integer> {

    /**
     * Most recently analysed first, capped.
     *
     * Post-fire analysis accumulates for as long as the system runs and every row is a
     * finished piece of history, so there is nothing to expire here - but the dashboard
     * only ever shows the recent ones, and an unbounded findAll would grow into the
     * response by itself.
     */
    List<BurnSeverity> findAllByOrderByPostDateDescComputedAtDesc(Limit limit);
}
