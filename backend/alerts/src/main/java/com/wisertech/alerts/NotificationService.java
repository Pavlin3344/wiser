package com.wisertech.alerts;

import java.util.List;

public interface NotificationService {
    void notifyNewAlerts(List<Alert> alerts);
}
