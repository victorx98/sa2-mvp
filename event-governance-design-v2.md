# Event Governance Design for DDD Projects

> A comprehensive guide to tracking, verifying, and documenting event producers and consumers in event-driven architectures.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Design Decisions](#design-decisions)
3. [Folder Structure](#folder-structure)
4. [Event Catalog](#event-catalog)
5. [Governance Implementation](#governance-implementation)
   - [Event Registry](#event-registry)
   - [Architecture Tests](#architecture-tests)
   - [Generated Documentation](#generated-documentation)
   - [Runtime Verification](#runtime-verification)
6. [Domain vs Integration Events](#domain-vs-integration-events)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Appendix: Code Examples](#appendix-code-examples)

---

## Problem Statement

As event-driven systems grow, teams face critical governance challenges:

- **Discoverability**: "Who publishes this event? Who consumes it?"
- **Verification**: "Are the declared producers/consumers actually correct?"
- **Drift Detection**: "Did someone add a handler without updating documentation?"
- **Impact Analysis**: "If I change this event, who will be affected?"
- **Scattered Handlers**: Event handlers spread across domains, application, and core layers

This document outlines a pragmatic approach that **formalizes existing patterns** rather than imposing theoretical purity.

---

## Design Decisions

### Key Architectural Choices

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Where do event definitions live? | `application/events/definitions/` | Consolidated location, application layer concern |
| Where do event handlers live? | `application/events/handlers/{consumer}/` | Grouped by consumer, easy to find "who reacts" |
| Where does registry live? | `application/events/registry/` | Co-located with event infrastructure |
| Can domains emit integration events? | **Yes** (pragmatic) | Already doing this; formalize rather than refactor |
| Domain events vs integration events? | Keep both concepts | Domain events internal, integration events cross-domain |

### Why Consolidate in `application/`?

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Before (Scattered)                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   domains/contract/event-handlers/     ← Contract's handlers        │
│   domains/financial/event-handlers/    ← Financial's handlers       │
│   core/calendar/listeners/             ← Calendar's handlers        │
│   application/commands/services/*.handler.ts  ← Mixed with commands │
│                                                                     │
│   Problem: "Where are all the handlers for X event?" → Hunt across  │
│            4+ directories                                           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     After (Consolidated)                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   application/events/                                               │
│   ├── definitions/     ← All event contracts                        │
│   ├── handlers/        ← All cross-domain handlers                  │
│   └── registry/        ← Governance infrastructure                  │
│                                                                     │
│   Benefit: Single location for all event-related code               │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Why Not `shared/`?

| Concern | `shared/events/` | `application/events/` |
|---------|------------------|----------------------|
| Dependency direction | ⚠️ Domains importing from shared is fine, but handlers need app-layer services | ✅ Natural: application orchestrates |
| Semantic fit | Events as "contracts" | Events as "application concerns" |
| Your codebase | Would require moving handlers out anyway | Aligns with existing command handler pattern |

**Conclusion**: For your codebase, `application/events/` is cleaner and more cohesive.

---

## Folder Structure

### Target Structure

```
src/
├── application/
│   ├── events/
│   │   ├── registry/                           # Event governance infrastructure
│   │   │   ├── types.ts                        # EventMetadata, interfaces
│   │   │   ├── event-registry.ts               # Registry singleton
│   │   │   ├── decorators.ts                   # @IntegrationEvent, @HandlesEvent
│   │   │   └── index.ts
│   │   │
│   │   ├── definitions/                        # All integration event definitions
│   │   │   ├── services/                       # Producer: Services domain
│   │   │   │   ├── session-completed.event.ts
│   │   │   │   ├── session-created.event.ts
│   │   │   │   └── index.ts
│   │   │   ├── financial/                      # Producer: Financial domain
│   │   │   │   ├── appeal-approved.event.ts
│   │   │   │   ├── appeal-created.event.ts
│   │   │   │   ├── settlement-confirmed.event.ts
│   │   │   │   └── index.ts
│   │   │   ├── placement/                      # Producer: Placement domain
│   │   │   │   ├── application-status-changed.event.ts
│   │   │   │   ├── application-status-rolled-back.event.ts
│   │   │   │   └── index.ts
│   │   │   ├── meeting/                        # Producer: Core/Meeting
│   │   │   │   ├── lifecycle-completed.event.ts
│   │   │   │   ├── status-changed.event.ts
│   │   │   │   ├── recording-ready.event.ts
│   │   │   │   └── index.ts
│   │   │   ├── contract/                       # Producer: Contract domain
│   │   │   │   ├── class-student-added.event.ts
│   │   │   │   ├── class-student-removed.event.ts
│   │   │   │   └── index.ts
│   │   │   ├── resume/                         # Producer: Resume subdomain
│   │   │   │   ├── resume-billed.event.ts
│   │   │   │   ├── resume-bill-cancelled.event.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts                        # Central export
│   │   │
│   │   ├── handlers/                           # All cross-domain event handlers
│   │   │   ├── services/                       # Consumer: Services domain
│   │   │   │   ├── on-meeting-completed.handler.ts
│   │   │   │   └── index.ts
│   │   │   ├── contract/                       # Consumer: Contract domain
│   │   │   │   ├── on-session-completed.handler.ts
│   │   │   │   ├── on-class-student-changed.handler.ts
│   │   │   │   ├── on-resume-billed.handler.ts
│   │   │   │   ├── on-placement-status-changed.handler.ts
│   │   │   │   └── index.ts
│   │   │   ├── financial/                      # Consumer: Financial domain
│   │   │   │   ├── on-session-completed.handler.ts
│   │   │   │   ├── on-appeal-approved.handler.ts
│   │   │   │   ├── on-settlement-confirmed.handler.ts
│   │   │   │   ├── on-placement-status-changed.handler.ts
│   │   │   │   └── index.ts
│   │   │   ├── calendar/                       # Consumer: Core/Calendar
│   │   │   │   ├── on-meeting-completed.handler.ts
│   │   │   │   └── index.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── publisher/                          # Event publishing infrastructure
│   │   │   ├── integration-event-publisher.ts
│   │   │   └── index.ts
│   │   │
│   │   └── index.ts
│   │
│   ├── commands/                               # Command handlers (separate from events)
│   │   ├── services/
│   │   │   ├── ai-career.service.ts            # Emits session events
│   │   │   ├── gap-analysis.service.ts
│   │   │   ├── regular-mentoring.service.ts
│   │   │   ├── comm-session.service.ts
│   │   │   └── class-session.service.ts
│   │   ├── financial/
│   │   │   ├── approve-mentor-appeal.command.ts
│   │   │   ├── create-mentor-appeal.command.ts
│   │   │   └── generate-settlement.command.ts
│   │   └── placement/
│   │       ├── update-job-application-status.command.ts
│   │       └── rollback-job-application-status.command.ts
│   │
│   └── sagas/                                  # Multi-step orchestrations
│       └── services/
│           └── session-provisioning.saga.ts
│
├── domains/
│   ├── contract/
│   │   ├── model/
│   │   │   └── events/                         # Domain events (internal only)
│   │   │       └── contract-signed.domain-event.ts
│   │   └── services/
│   │       └── contract.service.ts
│   │
│   ├── financial/
│   │   ├── model/
│   │   │   └── events/                         # Domain events (internal only)
│   │   └── services/
│   │       ├── mentor-appeal.service.ts        # Uses IntegrationEventPublisher
│   │       └── settlement.service.ts
│   │
│   ├── placement/
│   │   ├── model/
│   │   └── services/
│   │       └── job-application.service.ts      # Uses IntegrationEventPublisher
│   │
│   └── services/
│       ├── model/
│       └── resume/
│           └── services/
│               └── resume-domain.service.ts    # Uses IntegrationEventPublisher
│
├── core/
│   ├── meeting/
│   │   └── services/
│   │       └── meeting-lifecycle.service.ts    # Uses IntegrationEventPublisher
│   └── calendar/
│       └── services/
│
└── infrastructure/
    └── eventing/
        ├── transport/                          # EventEmitter2 wrapper
        ├── outbox/                             # Transactional outbox
        └── verified-event-bus.ts               # Runtime verification (optional)
```

### Key Principles

| Folder | Grouping | Contents |
|--------|----------|----------|
| `definitions/{producer}/` | By **producer** | Event class + schema + metadata |
| `handlers/{consumer}/` | By **consumer** | Handler classes that react to events |
| Domain `model/events/` | Internal only | Domain events, never imported cross-domain |

---

## Event Catalog

### Current Events (sa2-mvp)

#### Services Domain Events

| Event | Producers | Consumers |
|-------|-----------|-----------|
| `services.session.completed` | AiCareerEventHandler, GapAnalysisEventHandler, RegularMentoringEventHandler, CommSessionEventHandler | Contract, Financial |
| `ai_career.session.created` | AiCareerService | AiCareerEventHandler |
| `ai_career.session.updated` | AiCareerService | AiCareerEventHandler |
| `ai_career.session.cancelled` | AiCareerService | AiCareerEventHandler |
| `gap_analysis.session.created` | GapAnalysisService | GapAnalysisEventHandler |
| `gap_analysis.session.updated` | GapAnalysisService | GapAnalysisEventHandler |
| `gap_analysis.session.cancelled` | GapAnalysisService | GapAnalysisEventHandler |
| `regular_mentoring.session.created` | RegularMentoringService | RegularMentoringEventHandler |
| `regular_mentoring.session.updated` | RegularMentoringService | RegularMentoringEventHandler |
| `regular_mentoring.session.cancelled` | RegularMentoringService | RegularMentoringEventHandler |
| `comm_session.session.created` | CommSessionService | CommSessionEventHandler |
| `comm_session.session.updated` | CommSessionService | CommSessionEventHandler |
| `comm_session.session.cancelled` | CommSessionService | CommSessionEventHandler |
| `class_session.session.created` | ClassSessionService | ClassSessionEventHandler |
| `class_session.session.updated` | ClassSessionService | ClassSessionEventHandler |
| `class_session.session.cancelled` | ClassSessionService | ClassSessionEventHandler |

#### Meeting Events

| Event | Producers | Consumers |
|-------|-----------|-----------|
| `meeting.lifecycle.completed` | MeetingLifecycleService | AiCareerEventHandler, CommSessionEventHandler, GapAnalysisEventHandler, RegularMentoringEventHandler, CalendarListener, ClassSessionEventListener |
| `meeting.status.changed` | MeetingLifecycleService | (TBD) |
| `meeting.recording.ready` | MeetingLifecycleService | (TBD) |

#### Financial Domain Events

| Event | Producers | Consumers |
|-------|-----------|-----------|
| `financial.appeal.created` | MentorAppealService | (none visible) |
| `financial.appeal.approved` | MentorAppealService | AppealApprovedListener |
| `financial.appeal.rejected` | MentorAppealService | (none visible) |
| `financial.settlement.confirmed` | SettlementService | SettlementConfirmedListener |

#### Placement Domain Events

| Event | Producers | Consumers |
|-------|-----------|-----------|
| `placement.application.status_changed` | JobApplicationService, AssignReferralMentorCommand, CreateManualJobApplicationCommand, RecommendReferralApplicationsBatchCommand, UpdateJobApplicationStatusCommand | Contract, Financial |
| `placement.application.status_rolled_back` | JobApplicationService, RollbackJobApplicationStatusCommand | Contract, Financial |
| `placement.application.submitted` | JobApplicationService, UpdateJobApplicationStatusCommand | (TBD) |

#### Resume Events

| Event | Producers | Consumers |
|-------|-----------|-----------|
| `resume.billed` | ResumeDomainService | Contract (ResumeBilledListener) |
| `resume.bill.cancelled` | ResumeDomainService | Contract (ResumeBillCancelledListener) |

#### Contract Domain Events

| Event | Producers | Consumers |
|-------|-----------|-----------|
| `class.student.added` | (TBD) | Contract (ClassStudentEventListener) |
| `class.student.removed` | (TBD) | Contract (ClassStudentEventListener) |

### Event Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Event Flow Overview                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Session Services                                                          │
│   ┌──────────────┐                                                          │
│   │ AiCareer     │──┐                                                       │
│   │ GapAnalysis  │  │  {type}.session.created/updated/cancelled             │
│   │ RegularMentor│──┼──────────────────────────────────────┐                │
│   │ CommSession  │  │                                      ▼                │
│   │ ClassSession │──┘                             ┌────────────────┐        │
│   └──────────────┘                                │  EventHandlers │        │
│                                                   │  (Application) │        │
│                                                   └───────┬────────┘        │
│   Core/Meeting                                            │                 │
│   ┌──────────────┐     meeting.lifecycle.completed        │                 │
│   │ MeetingLife- │────────────────────────────────────────┤                 │
│   │ cycleService │                                        │                 │
│   └──────────────┘                                        ▼                 │
│                                                   services.session.completed│
│                                                           │                 │
│                              ┌────────────────────────────┼─────────────┐   │
│                              ▼                            ▼             │   │
│                      ┌──────────────┐            ┌──────────────┐       │   │
│                      │   Contract   │            │  Financial   │       │   │
│                      │    Domain    │            │    Domain    │       │   │
│                      └──────────────┘            └──────────────┘       │   │
│                                                                         │   │
│   Placement                                                             │   │
│   ┌──────────────┐     placement.application.status_changed             │   │
│   │ JobApplicat- │──────────────────────────────────────────────────────┘   │
│   │ ionService   │                                                          │
│   └──────────────┘                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Governance Implementation

### Event Registry

#### Core Types

```typescript
// application/events/registry/types.ts
import { z } from 'zod';

export interface EventMetadata {
  eventType: string;
  version: string;
  producers: string[];
  consumers: string[];
  schema: z.ZodSchema;
  description?: string;
  deprecated?: boolean;
  deprecationMessage?: string;
}

export interface ProducerDeclaration {
  type: string;
  version: string;
  producers: string[];
  description?: string;
}

export interface ConsumerDeclaration {
  eventType: string;
  consumer: string;
}
```

#### Registry Store

```typescript
// application/events/registry/event-registry.ts
import { EventMetadata } from './types';

class EventRegistryStore {
  private registry = new Map<string, EventMetadata>();

  register(meta: Omit<EventMetadata, 'consumers'> & { consumers?: string[] }): void {
    this.registry.set(meta.eventType, {
      ...meta,
      consumers: meta.consumers ?? [],
    });
  }

  get(eventType: string): EventMetadata | undefined {
    return this.registry.get(eventType);
  }

  addConsumer(eventType: string, consumer: string): void {
    const meta = this.registry.get(eventType);
    if (meta && !meta.consumers.includes(consumer)) {
      meta.consumers.push(consumer);
    }
  }

  getAll(): EventMetadata[] {
    return Array.from(this.registry.values());
  }

  getByProducer(producer: string): EventMetadata[] {
    return this.getAll().filter(e => e.producers.includes(producer));
  }

  getByConsumer(consumer: string): EventMetadata[] {
    return this.getAll().filter(e => e.consumers.includes(consumer));
  }

  getOrphans(): EventMetadata[] {
    return this.getAll().filter(e => e.consumers.length === 0);
  }
}

export const EventRegistry = new EventRegistryStore();
```

#### Decorators

```typescript
// application/events/registry/decorators.ts
import 'reflect-metadata';
import { EventRegistry } from './event-registry';
import { ProducerDeclaration } from './types';

/**
 * Decorator for Integration Event class definitions.
 * Registers the event with its declared producers.
 */
export function IntegrationEvent(meta: ProducerDeclaration) {
  return function <T extends { new (...args: any[]): {} }>(constructor: T) {
    const schema = (constructor as any).schema;

    EventRegistry.register({
      eventType: meta.type,
      version: meta.version,
      producers: meta.producers,
      schema: schema,
      description: meta.description,
    });

    Reflect.defineMetadata('integration-event', meta, constructor);

    return constructor;
  };
}

/**
 * Decorator for event handler methods.
 * Registers the consumer for the specified event.
 */
export function HandlesEvent(eventType: string, consumer: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    EventRegistry.addConsumer(eventType, consumer);

    Reflect.defineMetadata(
      'handles-event',
      { eventType, consumer },
      target,
      propertyKey
    );

    return descriptor;
  };
}
```

### Integration Event Publisher

Standardize how domain services emit events:

```typescript
// application/events/publisher/integration-event-publisher.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventRegistry } from '../registry';

export interface IntegrationEventBase {
  readonly eventType: string;
  readonly payload: Record<string, unknown>;
}

@Injectable()
export class IntegrationEventPublisher {
  private readonly logger = new Logger(IntegrationEventPublisher.name);

  constructor(private readonly eventEmitter: EventEmitter2) {}

  async publish<T extends IntegrationEventBase>(
    event: T,
    producer: string,
  ): Promise<void> {
    const meta = EventRegistry.get(event.eventType);

    // Warn if event is not registered (in dev)
    if (!meta) {
      this.logger.warn(`Unregistered event: ${event.eventType}`);
    }

    // Warn if producer is not declared (in dev)
    if (meta && !meta.producers.includes(producer)) {
      this.logger.warn(
        `${producer} is not a declared producer of ${event.eventType}`
      );
    }

    // Validate schema if available
    if (meta?.schema) {
      const result = meta.schema.safeParse(event.payload);
      if (!result.success) {
        this.logger.error(
          `Schema validation failed for ${event.eventType}`,
          result.error.format()
        );
        // In strict mode, throw here
      }
    }

    await this.eventEmitter.emitAsync(event.eventType, event);

    this.logger.debug(`Published ${event.eventType} from ${producer}`);
  }
}
```

### Architecture Tests

```typescript
// tests/architecture/event-governance.spec.ts
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

// Import all event definitions to populate registry
import '@/application/events/definitions';
import { EventRegistry } from '@/application/events/registry';

describe('Event Governance', () => {

  describe('Event Coverage', () => {

    it('every published event must have at least one declared consumer', () => {
      const orphans = EventRegistry.getOrphans();

      if (orphans.length > 0) {
        const orphanList = orphans
          .map(e => `  - ${e.eventType} (producers: ${e.producers.join(', ')})`)
          .join('\n');
        console.warn(`Events with no consumers:\n${orphanList}`);
        // Optionally fail: fail(`Found orphan events:\n${orphanList}`);
      }
    });

    it('every event must have at least one declared producer', () => {
      const unproduced = EventRegistry.getAll().filter(e => e.producers.length === 0);

      if (unproduced.length > 0) {
        const list = unproduced.map(e => `  - ${e.eventType}`).join('\n');
        fail(`Found events with no producers:\n${list}`);
      }
    });
  });

  describe('Handler Location', () => {

    it('all event handlers should be in application/events/handlers/', async () => {
      const wrongLocationHandlers: string[] = [];

      // Check for handlers in domain folders (legacy locations)
      const legacyPaths = [
        'src/domains/*/event-handlers/**/*.ts',
        'src/domains/**/listeners/**/*.ts',
        'src/core/**/listeners/**/*.ts',
      ];

      for (const pattern of legacyPaths) {
        const files = await glob(pattern, { ignore: ['**/*.spec.ts'] });
        wrongLocationHandlers.push(...files);
      }

      if (wrongLocationHandlers.length > 0) {
        console.warn(
          `Handlers in legacy locations (should migrate to application/events/handlers/):\n` +
          wrongLocationHandlers.map(f => `  - ${f}`).join('\n')
        );
      }
    });

    it('handlers are grouped by consumer module', async () => {
      const handlerDirs = await glob('src/application/events/handlers/*/');

      const expectedConsumers = ['services', 'contract', 'financial', 'calendar'];

      for (const dir of handlerDirs) {
        const consumer = path.basename(dir);
        if (!expectedConsumers.includes(consumer)) {
          console.warn(`Unexpected handler directory: ${dir}`);
        }
      }
    });
  });

  describe('Producer Verification', () => {

    it('declared producers actually emit the events they claim', async () => {
      const catalog = EventRegistry.getAll();
      const errors: string[] = [];

      for (const event of catalog) {
        // Simple heuristic: search for event type string in codebase
        const allFiles = await glob('src/**/*.ts', {
          ignore: ['**/*.spec.ts', '**/*.test.ts', '**/node_modules/**'],
        });

        const eventEmitted = allFiles.some(file => {
          const content = fs.readFileSync(file, 'utf-8');
          return (
            content.includes(`'${event.eventType}'`) ||
            content.includes(`"${event.eventType}"`)
          ) && (
            content.includes('.emit') ||
            content.includes('.publish') ||
            content.includes('eventBus') ||
            content.includes('eventEmitter')
          );
        });

        if (!eventEmitted) {
          errors.push(`Event "${event.eventType}" declared but never emitted`);
        }
      }

      if (errors.length > 0) {
        console.warn(`Producer verification warnings:\n${errors.join('\n')}`);
      }
    });
  });

  describe('Cross-Domain Boundaries', () => {

    it('domain events are not imported outside their domain', async () => {
      const domains = ['services', 'contract', 'financial', 'placement'];
      const violations: string[] = [];

      for (const domain of domains) {
        const domainEventPath = `domains/${domain}/model/events`;

        const otherFiles = await glob('src/**/*.ts', {
          ignore: [
            `src/domains/${domain}/**`,
            '**/*.spec.ts',
            '**/*.test.ts',
          ],
        });

        for (const file of otherFiles) {
          const content = fs.readFileSync(file, 'utf-8');
          if (content.includes(domainEventPath)) {
            violations.push(
              `${file} imports domain events from ${domain}`
            );
          }
        }
      }

      if (violations.length > 0) {
        fail(`Domain boundary violations:\n${violations.join('\n')}`);
      }
    });
  });
});
```

### Generated Documentation

```typescript
// scripts/generate-event-catalog.ts
import * as fs from 'fs';
import * as path from 'path';

// Import all events to populate registry
import '../src/application/events/definitions';
import { EventRegistry } from '../src/application/events/registry';

function generateEventCatalog(): void {
  const catalog = EventRegistry.getAll();
  const timestamp = new Date().toISOString();

  const outputDir = 'docs/events';
  fs.mkdirSync(outputDir, { recursive: true });

  // Generate Markdown
  const markdown = generateMarkdown(catalog, timestamp);
  fs.writeFileSync(path.join(outputDir, 'EVENT_CATALOG.md'), markdown);

  // Generate Mermaid
  const mermaid = generateMermaid(catalog);
  fs.writeFileSync(path.join(outputDir, 'event-flow.mermaid'), mermaid);

  // Generate JSON
  fs.writeFileSync(
    path.join(outputDir, 'event-catalog.json'),
    JSON.stringify(catalog, null, 2)
  );

  console.log(`✅ Event catalog generated at ${outputDir}`);
  console.log(`   - ${catalog.length} events documented`);
  console.log(`   - ${catalog.filter(e => e.consumers.length === 0).length} orphan events`);
}

function generateMarkdown(catalog: any[], timestamp: string): string {
  const orphans = catalog.filter(e => e.consumers.length === 0);

  return `# Event Catalog

> Auto-generated on ${timestamp}
> Total Events: ${catalog.length} | Orphans: ${orphans.length}

## Summary

| Event | Version | Producers | Consumers | Status |
|-------|---------|-----------|-----------|--------|
${catalog
  .sort((a, b) => a.eventType.localeCompare(b.eventType))
  .map(e => {
    const status = e.consumers.length === 0 ? '🔴 Orphan' : '✅ Active';
    return `| \`${e.eventType}\` | ${e.version} | ${e.producers.join(', ')} | ${e.consumers.join(', ') || '-'} | ${status} |`;
  })
  .join('\n')}

## Events by Domain

${generateByDomain(catalog)}
`;
}

function generateByDomain(catalog: any[]): string {
  const domains = ['services', 'financial', 'placement', 'meeting', 'contract', 'resume'];
  let output = '';

  for (const domain of domains) {
    const domainEvents = catalog.filter(e =>
      e.eventType.startsWith(domain) ||
      e.eventType.includes(domain)
    );

    if (domainEvents.length > 0) {
      output += `\n### ${domain.charAt(0).toUpperCase() + domain.slice(1)} Domain\n\n`;
      for (const event of domainEvents) {
        output += `#### \`${event.eventType}\`\n`;
        output += `- **Version**: ${event.version}\n`;
        output += `- **Producers**: ${event.producers.join(', ')}\n`;
        output += `- **Consumers**: ${event.consumers.join(', ') || '_None_'}\n`;
        if (event.description) {
          output += `- **Description**: ${event.description}\n`;
        }
        output += '\n';
      }
    }
  }

  return output;
}

function generateMermaid(catalog: any[]): string {
  let diagram = `flowchart LR\n`;

  // Collect unique producers and consumers
  const producers = new Set<string>();
  const consumers = new Set<string>();

  for (const event of catalog) {
    event.producers.forEach((p: string) => producers.add(p));
    event.consumers.forEach((c: string) => consumers.add(c));
  }

  // Add nodes
  diagram += `\n  subgraph Producers\n`;
  producers.forEach(p => {
    diagram += `    ${p.replace(/[^a-zA-Z0-9]/g, '')}["${p}"]\n`;
  });
  diagram += `  end\n`;

  diagram += `\n  subgraph Consumers\n`;
  consumers.forEach(c => {
    diagram += `    ${c.replace(/[^a-zA-Z0-9]/g, '')}["${c}"]\n`;
  });
  diagram += `  end\n\n`;

  // Add edges
  for (const event of catalog) {
    const eventLabel = event.eventType.split('.').slice(-2).join('.');
    for (const producer of event.producers) {
      for (const consumer of event.consumers) {
        const pId = producer.replace(/[^a-zA-Z0-9]/g, '');
        const cId = consumer.replace(/[^a-zA-Z0-9]/g, '');
        diagram += `  ${pId} -->|${eventLabel}| ${cId}\n`;
      }
    }
  }

  return diagram;
}

generateEventCatalog();
```

---

## Domain vs Integration Events

### The Pragmatic Approach

For your codebase, **domain services emit integration events directly**. This is acceptable when:

- 1:1 mapping between domain action and cross-domain announcement
- Small team, single codebase
- Rapid iteration priority

### When to Use Domain Events

Keep internal domain events for:

- Fine-grained state changes not relevant to other domains
- Event sourcing within a domain
- Complex aggregates with multiple state transitions

```typescript
// domains/contract/model/contract.aggregate.ts
export class Contract extends AggregateRoot {
  sign(signedBy: string, signedAt: Date): void {
    // Internal domain event (not cross-domain)
    this.addDomainEvent(new ContractSignedDomainEvent({
      contractId: this.id,
      signedBy,
      signedAt,
    }));

    // If needed, also prepare integration event
    // (or let application layer translate)
  }
}
```

### Best Practice: Use IntegrationEventPublisher

Even with direct emission, standardize through the publisher:

```typescript
// domains/financial/services/mentor-appeal.service.ts
@Injectable()
export class MentorAppealService {
  constructor(
    private readonly eventPublisher: IntegrationEventPublisher,
    private readonly appealRepo: MentorAppealRepository,
  ) {}

  async approveAppeal(appealId: string): Promise<void> {
    const appeal = await this.appealRepo.findById(appealId);
    appeal.approve();
    await this.appealRepo.save(appeal);

    // Use publisher instead of raw eventEmitter
    await this.eventPublisher.publish(
      new AppealApprovedEvent({
        appealId: appeal.id,
        approvedAt: new Date().toISOString(),
        mentorId: appeal.mentorId,
      }),
      'FinancialModule',
    );
  }
}
```

---

## Implementation Roadmap

### Phase 1: Registry Infrastructure (Week 1)

**Goal**: Add governance without breaking existing code.

```bash
# Create new structure
mkdir -p src/application/events/{registry,definitions,handlers,publisher}

# Add registry files
touch src/application/events/registry/{types,event-registry,decorators,index}.ts
touch src/application/events/publisher/integration-event-publisher.ts
```

**Tasks**:
- [ ] Create `EventRegistry` store
- [ ] Create `@IntegrationEvent` and `@HandlesEvent` decorators
- [ ] Create `IntegrationEventPublisher` service
- [ ] Add to application module

### Phase 2: Event Definitions (Week 2)

**Goal**: Define all integration events with schemas.

```bash
# Create event definitions by producer
mkdir -p src/application/events/definitions/{services,financial,placement,meeting,contract,resume}
```

**Tasks**:
- [ ] Create event classes for each event type
- [ ] Add Zod schemas for validation
- [ ] Apply `@IntegrationEvent` decorator
- [ ] Export from central index

### Phase 3: Migrate Handlers (Week 3-4)

**Goal**: Consolidate handlers into `application/events/handlers/`.

**Migration order**:
1. [ ] `domains/financial/event-handlers/` → `application/events/handlers/financial/`
2. [ ] `domains/contract/event-handlers/` → `application/events/handlers/contract/`
3. [ ] `core/calendar/listeners/` → `application/events/handlers/calendar/`
4. [ ] `domains/services/**/listeners/` → `application/events/handlers/services/`

**Per handler**:
- [ ] Move file to new location
- [ ] Add `@HandlesEvent` decorator
- [ ] Update imports
- [ ] Update module registration

### Phase 4: Standardize Producers (Week 5)

**Goal**: All event emission goes through `IntegrationEventPublisher`.

**Tasks**:
- [ ] Update `MentorAppealService` to use publisher
- [ ] Update `SettlementService` to use publisher
- [ ] Update `JobApplicationService` to use publisher
- [ ] Update `ResumeDomainService` to use publisher
- [ ] Update `MeetingLifecycleService` to use publisher
- [ ] Update session services (AiCareer, GapAnalysis, etc.)

### Phase 5: Add Verification (Week 6)

**Goal**: Prevent drift with automated checks.

**Tasks**:
- [ ] Add architecture tests
- [ ] Add to CI pipeline
- [ ] Generate initial documentation
- [ ] Set up catalog generation in build

---

## Appendix: Code Examples

### Complete Event Definition

```typescript
// application/events/definitions/services/session-completed.event.ts
import { z } from 'zod';
import { IntegrationEvent } from '../../registry/decorators';

export const SessionCompletedPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  sessionType: z.enum([
    'ai_career',
    'gap_analysis',
    'regular_mentoring',
    'comm_session',
    'class_session',
  ]),
  completedAt: z.string().datetime(),
  mentorId: z.string().uuid(),
  studentId: z.string().uuid(),
  durationMinutes: z.number().int().positive().optional(),
});

export type SessionCompletedPayload = z.infer<typeof SessionCompletedPayloadSchema>;

@IntegrationEvent({
  type: 'services.session.completed',
  version: '1.0',
  producers: [
    'AiCareerEventHandler',
    'GapAnalysisEventHandler',
    'RegularMentoringEventHandler',
    'CommSessionEventHandler',
  ],
  description: 'Emitted when any session type reaches completion',
})
export class SessionCompletedEvent {
  static readonly schema = SessionCompletedPayloadSchema;
  static readonly eventType = 'services.session.completed' as const;

  readonly eventType = SessionCompletedEvent.eventType;

  constructor(public readonly payload: SessionCompletedPayload) {}
}
```

### Complete Handler

```typescript
// application/events/handlers/financial/on-session-completed.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HandlesEvent } from '../../registry/decorators';
import { SessionCompletedEvent } from '../../definitions/services';
import { BillingService } from '@/domains/financial/services/billing.service';

@Injectable()
export class FinancialOnSessionCompletedHandler {
  private readonly logger = new Logger(FinancialOnSessionCompletedHandler.name);

  constructor(private readonly billingService: BillingService) {}

  @OnEvent(SessionCompletedEvent.eventType)
  @HandlesEvent(SessionCompletedEvent.eventType, 'FinancialModule')
  async handle(event: SessionCompletedEvent): Promise<void> {
    this.logger.log(
      `Processing session completion for billing: ${event.payload.sessionId}`
    );

    try {
      await this.billingService.processSessionCompletion({
        sessionId: event.payload.sessionId,
        sessionType: event.payload.sessionType,
        mentorId: event.payload.mentorId,
        studentId: event.payload.studentId,
        completedAt: new Date(event.payload.completedAt),
      });
    } catch (error) {
      this.logger.error(
        `Failed to process billing for session ${event.payload.sessionId}`,
        error.stack
      );
      throw error;
    }
  }
}
```

### Handler Module Registration

```typescript
// application/events/handlers/financial/index.ts
import { Module } from '@nestjs/common';
import { FinancialOnSessionCompletedHandler } from './on-session-completed.handler';
import { FinancialOnAppealApprovedHandler } from './on-appeal-approved.handler';
import { FinancialOnPlacementStatusChangedHandler } from './on-placement-status-changed.handler';
import { FinancialDomainModule } from '@/domains/financial/financial.module';

@Module({
  imports: [FinancialDomainModule],
  providers: [
    FinancialOnSessionCompletedHandler,
    FinancialOnAppealApprovedHandler,
    FinancialOnPlacementStatusChangedHandler,
  ],
})
export class FinancialEventHandlersModule {}
```

```typescript
// application/events/handlers/index.ts
import { Module } from '@nestjs/common';
import { FinancialEventHandlersModule } from './financial';
import { ContractEventHandlersModule } from './contract';
import { ServicesEventHandlersModule } from './services';
import { CalendarEventHandlersModule } from './calendar';

@Module({
  imports: [
    FinancialEventHandlersModule,
    ContractEventHandlersModule,
    ServicesEventHandlersModule,
    CalendarEventHandlersModule,
  ],
})
export class EventHandlersModule {}
```

---

## References

- [Event-Driven Architecture Patterns](https://microservices.io/patterns/data/event-driven-architecture.html)
- [Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- [NestJS Event Emitter](https://docs.nestjs.com/techniques/events)
- [AsyncAPI Specification](https://www.asyncapi.com/)
- [Event Catalog](https://www.eventcatalog.dev/)
