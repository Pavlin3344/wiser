package com.wisertech.api;

import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
public class FireStreamController {

    private final FireStreamService fireStreamService;

    public FireStreamController(FireStreamService fireStreamService) {
        this.fireStreamService = fireStreamService;
    }

    @GetMapping(path = "/api/v1/fires/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        return fireStreamService.subscribe();
    }
}
