package com.wisertech.alerts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.List;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

class EmailNotificationServiceTest {

    private static Alert alert(String severity, String message) {
        return new Alert(1L, "proximity", severity, "hospital", 2L, message);
    }

    @Test
    void doesNotSendWhenDisabled() {
        JavaMailSender sender = mock(JavaMailSender.class);
        var service = new EmailNotificationService(sender, false, "wiser@x.com", "ops@x.com");

        service.notifyNewAlerts(List.of(alert("critical", "burning")));

        verify(sender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void doesNotSendWhenNoRecipientsConfigured() {
        JavaMailSender sender = mock(JavaMailSender.class);
        var service = new EmailNotificationService(sender, true, "wiser@x.com", "");

        service.notifyNewAlerts(List.of(alert("critical", "burning")));

        verify(sender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void skipsMediumSeverityOnly() {
        JavaMailSender sender = mock(JavaMailSender.class);
        var service = new EmailNotificationService(sender, true, "wiser@x.com", "ops@x.com");

        service.notifyNewAlerts(List.of(alert("medium", "far away")));

        verify(sender, never()).send(any(SimpleMailMessage.class));
    }

    @Test
    void sendsOneDigestCoveringUrgentAlertsOnly() {
        JavaMailSender sender = mock(JavaMailSender.class);
        var service = new EmailNotificationService(sender, true, "wiser@x.com", "ops@x.com, chief@x.com");

        service.notifyNewAlerts(List.of(
                alert("critical", "next to hospital"),
                alert("high", "near substation"),
                alert("medium", "far away")));

        ArgumentCaptor<SimpleMailMessage> captor = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(captor.capture());

        SimpleMailMessage sent = captor.getValue();
        assertThat(sent.getTo()).containsExactly("ops@x.com", "chief@x.com");
        assertThat(sent.getSubject()).contains("2");
        assertThat(sent.getText()).contains("next to hospital").contains("near substation");
        assertThat(sent.getText()).doesNotContain("far away");
    }

    @Test
    void swallowsSendFailureSoAlertsStillPersist() {
        JavaMailSender sender = mock(JavaMailSender.class);
        doThrow(new RuntimeException("smtp down")).when(sender).send(any(SimpleMailMessage.class));
        var service = new EmailNotificationService(sender, true, "wiser@x.com", "ops@x.com");

        service.notifyNewAlerts(List.of(alert("critical", "burning")));
    }
}
