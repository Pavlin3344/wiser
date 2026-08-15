package com.wisertech.api;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException e) {
        Map<String, String> fieldErrors = new LinkedHashMap<>();
        for (var error : e.getBindingResult().getFieldErrors()) {
            fieldErrors.put(error.getField(), error.getDefaultMessage());
        }
        return ResponseEntity.badRequest().body(Map.of(
                "error", "validation_failed",
                "fields", fieldErrors));
    }

    @ExceptionHandler(RoutingTopologyMissingException.class)
    public ResponseEntity<Map<String, Object>> handleMissingTopology(RoutingTopologyMissingException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                "error", "routing_topology_missing",
                "message", e.getMessage()));
    }
}
