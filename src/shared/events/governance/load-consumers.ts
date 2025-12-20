/**
 * Load all integration-event consumers so their `@HandlesEvent` decorators
 * register in the EventRegistry.
 *
 * Import for side effects only.
 */

// Application handlers
import "@application/commands/services/regular-mentoring-event.handler";
import "@application/commands/services/gap-analysis-event.handler";
import "@application/commands/services/ai-career-event.handler";
import "@application/commands/services/comm-session-event.handler";
import "@application/commands/services/class-session-event.handler";

// Core listeners
import "@core/calendar/listeners/meeting-completed.listener";

// Services domain listeners
import "@domains/services/class/class-sessions/listeners/class-session-event.listener";
import "@domains/services/service-registry/listeners/placement-application-submitted.listener";

// Financial domain listeners
import "@domains/financial/events/listeners/service-session-completed-listener";
import "@domains/financial/events/listeners/settlement-confirmed.listener";
import "@domains/financial/events/listeners/placement-application-status-changed.listener";
import "@domains/financial/events/listeners/placement-application-status-rolled-back.listener";
import "@domains/financial/events/listeners/appeal-approved.listener";

// Contract domain listeners
import "@domains/contract/events/listeners/session-completed-listener";
import "@domains/contract/events/listeners/resume-billed-listener";
import "@domains/contract/events/listeners/resume-bill-cancelled-listener";
import "@domains/contract/events/listeners/class-student-event-listener";
import "@domains/contract/events/listeners/placement-event.listener";

// Observability / orphan-consumer fallback
import "@telemetry/event-governance.listener";

