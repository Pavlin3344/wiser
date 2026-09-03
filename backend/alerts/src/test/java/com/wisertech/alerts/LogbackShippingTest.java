package com.wisertech.alerts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import org.junit.jupiter.api.Test;

/**
 * Guards the two ways log shipping can break without anyone noticing.
 *
 * <p>Both matter because the symptom is identical to a network fault - no logs arrive -
 * and the network is by far the more expensive place to go looking. The appender itself is
 * proven end to end by the deployment; what cannot be proven there quickly is why it was
 * never attached in the first place.
 */
class LogbackShippingTest {

    private static final Path CONFIG =
            Path.of("src", "main", "resources", "logback-spring.xml");

    /**
     * logback evaluates {@code <if>} through Janino. Drop that dependency and the condition
     * is skipped silently: the Logstash appender is never added, the application starts
     * perfectly, and nothing is logged loudly enough to notice.
     */
    @Test
    void janinoIsOnTheClasspathSoTheConditionEvaluates() {
        assertThatCode(() -> Class.forName("org.codehaus.janino.ScriptEvaluator"))
                .as("logback's <if> silently does nothing without Janino")
                .doesNotThrowAnyException();
    }

    @Test
    void encoderIsOnTheClasspath() {
        assertThatCode(() -> Class.forName(
                "net.logstash.logback.appender.LogstashTcpSocketAppender"))
                .doesNotThrowAnyException();
    }

    /**
     * wiser.conf reads `service` from a Docker compose label, which no Container App sends.
     * If customFields is lost in an edit, every Azure line still arrives - and lands under
     * service "unknown", which makes the field useless for filtering without any error to
     * point at the cause.
     */
    @Test
    void configCarriesTheFieldsTheLogstashPipelineDependsOn() throws Exception {
        String xml = Files.readString(CONFIG, StandardCharsets.UTF_8);

        assertThat(xml)
                .as("service name is what Kibana filters on")
                .contains("\"service\":\"alerts\"")
                .as("origin separates Azure from the filebeat-fed Hetzner lines")
                .contains("\"origin\":\"azure\"");

        assertThat(xml)
                .as("field names have to match wiser-logs-template.json")
                .contains("<level>log_level</level>")
                .contains("<stackTrace>stack_trace</stackTrace>")
                .contains("<timestamp>@timestamp</timestamp>");

        assertThat(xml)
                .as("a batch job exits in ~30s; without a shutdown hook the last lines - "
                        + "including whatever explains a failure - never leave the ring buffer")
                .contains("shutdownHook");

        assertThat(xml)
                .as("the console appender must survive: it is what Log Analytics captures, "
                        + "so losing it would mean losing logs entirely whenever Logstash is down")
                .contains("<appender-ref ref=\"CONSOLE\"/>");
    }

    /** Unset host must leave the appender off, so Compose behaviour is untouched. */
    @Test
    void shippingIsOffByDefault() throws Exception {
        String xml = Files.readString(CONFIG, StandardCharsets.UTF_8);
        assertThat(xml).contains("defaultValue=\"\"");
        assertThat(xml).contains("!\"\".equals(property(\"logstashHost\"))");
    }
}
