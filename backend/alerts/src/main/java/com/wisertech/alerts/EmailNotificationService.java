package com.wisertech.alerts;

import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailNotificationService implements NotificationService {
    private static final Logger log = LoggerFactory.getLogger(EmailNotificationService.class);

    private final JavaMailSender mailSender;
    private final boolean enabled;
    private final String from;
    private final String[] recipients;

    public EmailNotificationService(
            JavaMailSender mailSender,
            @Value("${alerts.notify.enabled}") boolean enabled,
            @Value("${alerts.notify.from}") String from,
            @Value("${alerts.notify.to}") String recipients) {
        this.mailSender = mailSender;
        this.enabled = enabled;
        this.from = from;
        this.recipients = recipients.isBlank() ? new String[0] : recipients.split("\\s*,\\s*");
    }

    @Override
    public void notifyNewAlerts(List<Alert> alerts) {
        if (!enabled || recipients.length == 0) {
            return;
        }

        List<Alert> urgent = alerts.stream()
                .filter(a -> "critical".equals(a.getSeverity()) || "high".equals(a.getSeverity()))
                .toList();
        if (urgent.isEmpty()) {
            return;
        }

        SimpleMailMessage mail = new SimpleMailMessage();
        mail.setFrom(from);
        mail.setTo(recipients);
        mail.setSubject("Wiser: %d new fire proximity alert(s)".formatted(urgent.size()));
        mail.setText(body(urgent));

        // A failed send must not roll back alerts already written to the database - the
        // stored alert is the record of record, the email is only a courtesy copy.
        try {
            mailSender.send(mail);
            log.info("Sent alert notification email covering {} alerts.", urgent.size());
        } catch (Exception e) {
            log.error("Failed to send alert notification email.", e);
        }
    }

    private String body(List<Alert> urgent) {
        StringBuilder sb = new StringBuilder();
        for (Alert a : urgent) {
            sb.append("[%s] %s%n".formatted(a.getSeverity().toUpperCase(), a.getMessage()));
        }
        return sb.toString();
    }
}
