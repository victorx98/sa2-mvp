import {
  pgTable,
  uuid,
  varchar,
  text,
  json,
  timestamp,
  integer,
  pgEnum,
} from "drizzle-orm/pg-core";

// Event status enum
export const eventStatusEnum = pgEnum("event_status", [
  "pending", // Pending publication
  "published", // Successfully published
  "failed", // Publication failed after retries
]);

/**
 * Domain events table (Transactional Outbox Pattern)
 * Ensures reliable event publishing through atomic database writes
 *
 * Key features:
 * - Transactional consistency: Events created in same transaction as business data
 * - Background publishing: Polling task scans pending events (30s interval)
 * - Retry mechanism: Max 3 retries (configurable via EVENT_PUBLISHER_MAX_RETRIES)
 * - Idempotency: Consumers must implement idempotent handling (dedupe by event.id)
 * - Cleanup strategy: Published events retained for 30 days before archival/deletion
 *
 * Outbox pattern benefits:
 * - Guarantees at-least-once delivery
 * - No message loss even if publisher crashes
 * - Events published in same order as created
 * - Advisory lock prevents multi-instance conflicts
 *
 * Supported event types:
 * - contract.signed: Contract signed
 * - contract.activated: Contract activated
 * - contract.suspended: Contract suspended
 * - contract.resumed: Contract resumed
 * - contract.completed: Contract completed
 * - contract.terminated: Contract terminated
 * - entitlement.added: Additional entitlement added
 * - service.consumed: Service consumption completed
 */
export const domainEvents = pgTable("domain_events", {
  // Primary key
  id: uuid("id").defaultRandom().primaryKey(),

  // Event identification
  eventType: varchar("event_type", { length: 100 }).notNull(), // e.g., 'contract.signed', 'contract.activated'

  // Aggregate root reference
  aggregateId: uuid("aggregate_id").notNull(), // e.g., contractId
  aggregateType: varchar("aggregate_type", { length: 50 })
    .notNull()
    .default("Contract"), // e.g., 'Contract', 'ServiceEntitlement'

  // Event payload (JSONB format)
  payload: json("payload").$type<Record<string, any>>().notNull(),

  // Publication status
  status: eventStatusEnum("status").notNull().default("pending"),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  publishedAt: timestamp("published_at", { withTimezone: true }), // When event was successfully published

  // Retry information
  retryCount: integer("retry_count").notNull().default(0), // Current retry count
  maxRetries: integer("max_retries").notNull().default(3), // Max retries before marking as failed
  errorMessage: text("error_message"), // Last error message (for troubleshooting)

  // Metadata (optional)
  metadata: json("metadata").$type<{
    correlationId?: string; // Correlation ID for tracing
    causationId?: string; // Causation ID (what triggered this event)
    publishedBy?: string; // Publisher information (service name/instance)
  }>(),
});

// Type inference
export type DomainEvent = typeof domainEvents.$inferSelect;
export type InsertDomainEvent = typeof domainEvents.$inferInsert;

/*
 * Indexes (to be created in contract_indexes.sql):
 * - CREATE INDEX idx_domain_events_status ON domain_events(status);
 *   (Critical for publisher polling - finds pending events)
 * - CREATE INDEX idx_domain_events_created_at ON domain_events(created_at);
 *   (For ordered event processing)
 * - CREATE INDEX idx_domain_events_aggregate ON domain_events(aggregate_type, aggregate_id);
 *   (For querying events by aggregate root)
 * - CREATE INDEX idx_domain_events_event_type ON domain_events(event_type);
 *   (For filtering events by type)
 * - CREATE INDEX idx_domain_events_pending ON domain_events(created_at) WHERE status = 'pending';
 *   (Partial index for efficient publisher queries)
 *
 * Background publisher task (event-publisher.task.ts):
 * - Runs every EVENT_PUBLISHER_POLL_INTERVAL_MS (default: 30000ms - 30 seconds)
 * - Acquires advisory lock to prevent multi-instance conflicts
 * - Query: SELECT * FROM domain_events WHERE status = 'pending' ORDER BY created_at LIMIT 100
 * - Publishes events to message broker (e.g., RabbitMQ, Kafka)
 * - Updates status to 'published' on success, increments retry_count on failure
 * - Marks as 'failed' when retry_count >= max_retries
 *
 * Business rules:
 * 1. Events are created in the same transaction as business operations
 * 2. Publisher task polls every 30 seconds for pending events
 * 3. Failed events are retried up to max_retries times
 * 4. Consumers must implement idempotent handling (use event.id for deduplication)
 * 5. Published events are retained for 30 days before cleanup
 *
 * Environment variables:
 * - EVENT_PUBLISHER_POLL_INTERVAL_MS: Polling interval in milliseconds (default: 30000)
 * - EVENT_PUBLISHER_MAX_RETRIES: Max retry count (default: 3)
 * - EVENT_PUBLISHER_BATCH_SIZE: Number of events to process per batch (default: 100)
 * - EVENT_RETENTION_DAYS: Days to retain published events (default: 30)
 */
