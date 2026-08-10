package com.wisertech.api;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

@WebMvcTest(AlertController.class)
class AlertControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AlertRepository alertRepository;

    @Test
    void getAlerts_returnsListShape() throws Exception {
        // Alert (api's copy) is intentionally read-only - no setters, since api never creates
        // alert rows itself - so ReflectionTestUtils populates this fixture instead of adding
        // a setter that would exist purely for tests.
        Alert alert = new Alert();
        ReflectionTestUtils.setField(alert, "alertType", "proximity");
        ReflectionTestUtils.setField(alert, "severity", "critical");
        ReflectionTestUtils.setField(alert, "message", "Fire detected 500m from Test Hospital (hospital)");
        when(alertRepository.findAll()).thenReturn(List.of(alert));

        mockMvc.perform(get("/api/alerts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].alertType").value("proximity"))
                .andExpect(jsonPath("$[0].severity").value("critical"))
                .andExpect(jsonPath("$[0].message").value("Fire detected 500m from Test Hospital (hospital)"));
    }
}
