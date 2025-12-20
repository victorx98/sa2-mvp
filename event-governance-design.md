# Event Governance Design for DDD Projects

> A comprehensive guide to tracking, verifying, and documenting event producers and consumers in event-driven architectures.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Folder Structure Overview](#folder-structure-overview)
3. [Governance Approaches](#governance-approaches)
   - [Approach 1: Event Registry with Decorators](#approach-1-event-registry-with-decorators)
   - [Approach 2: Architecture Tests](#approach-2-architecture-tests)
   - [Approach 3: Generated Documentation](#approach-3-generated-documentation)
   - [Approach 4: Runtime Verification](#approach-4-runtime-verification)
4. [Industry Best Practices](#industry-best-practices)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Appendix: Complete Code Examples](#appendix-complete-code-examples)

---

## Problem Statement

As event-driven systems grow, teams face critical governance challenges:

- **Discoverability**: "Who publishes this event? Who consumes it?"
- **Verification**: "Are the declared producers/consumers actually correct?"
- **Drift Detection**: "Did someone add a handler without updating documentation?"
- **Impact Analysis**: "If I change this event, who will be affected?"

This document outlines a multi-layered approach to solve these problems.

---

## Folder Structure Overview

The recommended folder structure separates concerns clearly:

```
src/
├── shared/
│   └── events/                       # Integration Events (Published Language)
│       ├── registry/                 # Event registry infrastructure
│       │   ├── event-registry.ts
│       │   ├── decorators.ts
│       │   └── types.ts
│       ├── services/                 # Events produced by Services domain
│       ├── contract/                 # Events produced by Contract domain
│       ├── financial/                # Events produced by Financial domain
│       └── index.ts                  # Exports + registry helpers
│
├── domains/
│   ├── services/
│   │   └── model/
│   │       └── events/               # Domain events (internal, NOT published)
│   ├── contract/
│   │   └── model/
│   │       └── events/
│   └── financial/
│       └── model/
│           └── events/
│
├── application/
│   ├── event-handlers/               # 1-step reactions to Integration Events
│   │   ├── services/                 # Grouped by CONSUMER
│   │   ├── contract/
│   │   └── financial/
│   ├── sagas/                        # Multi-step orchestrations
│   │   └── services/
│   │       └── session-provisioning.saga.ts
│   └── commands/                     # Command handlers
│       ├── services/
│       └── core/
│
├── infrastructure/
│   └── eventing/                     # Transport mechanics
│       ├── transport/                # EventEmitter2 / MQ implementation
│       ├── bridge/                   # Wire transport → CQRS EventBus
│       ├── outbox/                   # Outbox pattern implementation
│       └── verified-event-bus.ts     # Runtime verification layer
│
└── core/                             # Shared Kernel / Platform capabilities
    ├── webhook/                      # External inbound events
    └── meeting/                      # Meeting lifecycle management
```

### Key Design Principles

| Folder | Ownership | Grouping Strategy |
|--------|-----------|-------------------|
| `shared/events/{domain}/` | Producer owns schema | By **producer** |
| `application/event-handlers/{domain}/` | Consumer owns reaction | By **consumer** |
| `domains/*/model/events/` | Domain-internal only | Never cross-domain imported |

---

## Governance Approaches

### Approach 1: Event Registry with Decorators

**Purpose**: Compile-time + runtime single source of truth for all events.

#### Core Types

```typescript
// shared/events/registry/types.ts
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

#### Event Registry

```typescript
// shared/events/registry/event-registry.ts
import { EventMetadata } from './types';

class EventRegistryClass {
  private registry = new Map<string, EventMetadata>();

  register(meta: EventMetadata): void {
    this.registry.set(meta.eventType, meta);
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

  getUnproduced(): EventMetadata[] {
    return this.getAll().filter(e => e.producers.length === 0);
  }
}

export const EventRegistry = new EventRegistryClass();
```

#### Decorators

```typescript
// shared/events/registry/decorators.ts
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
      consumers: [],
      schema: schema,
      description: meta.description,
    });

    // Store metadata on the class for runtime access
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
    
    // Store metadata on the method for runtime verification
    Reflect.defineMetadata(
      'handles-event',
      { eventType, consumer },
      target,
      propertyKey
    );
    
    return descriptor;
  };
}

/**
 * Decorator for saga classes that handle events.
 */
export function SagaHandlesEvent(eventType: string, consumer: string) {
  return function (constructor: Function) {
    EventRegistry.addConsumer(eventType, consumer);
    Reflect.defineMetadata(
      'saga-handles-event',
      { eventType, consumer },
      constructor
    );
  };
}
```

#### Usage Example

```typescript
// shared/events/services/session-completed.event.ts
import { z } from 'zod';
import { IntegrationEvent } from '../registry/decorators';

export const SessionCompletedPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  serviceId: z.string().uuid(),
  studentId: z.string().uuid(),
  mentorId: z.string().uuid(),
  completedAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  status: z.enum(['completed', 'cancelled', 'no-show']),
});

export type SessionCompletedPayload = z.infer<typeof SessionCompletedPayloadSchema>;

@IntegrationEvent({
  type: 'services.session.completed',
  version: '1.0',
  producers: ['ServicesModule'],
  description: 'Emitted when a tutoring session is completed',
})
export class SessionCompletedEvent {
  static readonly schema = SessionCompletedPayloadSchema;
  static readonly eventType = 'services.session.completed';

  constructor(public readonly payload: SessionCompletedPayload) {}
}
```

```typescript
// application/event-handlers/financial/on-session-completed.handler.ts
import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HandlesEvent } from '@/shared/events/registry/decorators';
import { SessionCompletedEvent } from '@/shared/events/services/session-completed.event';

@Injectable()
export class FinancialSessionHandlers {
  
  @OnEvent('services.session.completed')
  @HandlesEvent('services.session.completed', 'FinancialModule')
  async handleSessionCompleted(event: SessionCompletedEvent): Promise<void> {
    // Trigger billing calculation, revenue recognition, etc.
  }
}
```

---

### Approach 2: Architecture Tests

**Purpose**: Automated verification that declared producers/consumers match actual code behavior.

#### Test Suite

```typescript
// tests/architecture/event-governance.spec.ts
import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { EventRegistry } from '@/shared/events/registry';

// Import all event definitions to populate registry
import '@/shared/events';

describe('Event Governance', () => {
  
  describe('Event Coverage', () => {
    
    it('every published event must have at least one declared consumer', () => {
      const orphans = EventRegistry.getOrphans();
      
      if (orphans.length > 0) {
        const orphanList = orphans.map(e => `  - ${e.eventType}`).join('\n');
        fail(`Found events with no consumers:\n${orphanList}`);
      }
    });

    it('every event must have at least one declared producer', () => {
      const unproduced = EventRegistry.getUnproduced();
      
      if (unproduced.length > 0) {
        const list = unproduced.map(e => `  - ${e.eventType}`).join('\n');
        fail(`Found events with no producers:\n${list}`);
      }
    });

    it('no deprecated events should have new consumers', () => {
      const deprecated = EventRegistry.getAll().filter(e => e.deprecated);
      // This is a warning, not a failure - log for visibility
      deprecated.forEach(e => {
        if (e.consumers.length > 0) {
          console.warn(
            `Deprecated event ${e.eventType} still has consumers: ${e.consumers.join(', ')}`
          );
        }
      });
    });
  });

  describe('Producer Verification', () => {
    
    it('declared producers actually emit the events they claim', async () => {
      const catalog = EventRegistry.getAll();
      const errors: string[] = [];

      for (const event of catalog) {
        for (const producer of event.producers) {
          const moduleName = producer.replace('Module', '').toLowerCase();
          const producerFiles = await glob(
            `src/**/${moduleName}/**/*.ts`,
            { ignore: ['**/*.spec.ts', '**/*.test.ts'] }
          );

          const emitsEvent = producerFiles.some(file => {
            const content = fs.readFileSync(file, 'utf-8');
            return (
              content.includes(event.eventType) &&
              (content.includes('.publish(') ||
                content.includes('.emit(') ||
                content.includes('eventBus.'))
            );
          });

          if (!emitsEvent) {
            errors.push(
              `${producer} claims to produce "${event.eventType}" but no emit found`
            );
          }
        }
      }

      if (errors.length > 0) {
        fail(`Producer verification failed:\n${errors.map(e => `  - ${e}`).join('\n')}`);
      }
    });
  });

  describe('Consumer Verification', () => {
    
    it('all @OnEvent decorators reference known events', async () => {
      const knownEvents = new Set(EventRegistry.getAll().map(e => e.eventType));
      const handlerFiles = await glob('src/application/event-handlers/**/*.ts');
      const errors: string[] = [];

      for (const file of handlerFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const matches = content.matchAll(/@OnEvent\(['"`](.+?)['"`]\)/g);

        for (const match of matches) {
          const eventType = match[1];
          if (!knownEvents.has(eventType)) {
            errors.push(`${path.basename(file)}: subscribes to unknown event "${eventType}"`);
          }
        }
      }

      if (errors.length > 0) {
        fail(`Unknown event subscriptions:\n${errors.map(e => `  - ${e}`).join('\n')}`);
      }
    });

    it('event handlers are in the correct consumer folder', async () => {
      const catalog = EventRegistry.getAll();
      const errors: string[] = [];

      for (const event of catalog) {
        for (const consumer of event.consumers) {
          const moduleName = consumer.replace('Module', '').toLowerCase();
          const expectedPath = `src/application/event-handlers/${moduleName}`;

          const handlerFiles = await glob(`${expectedPath}/**/*.ts`);
          const hasHandler = handlerFiles.some(file => {
            const content = fs.readFileSync(file, 'utf-8');
            return content.includes(event.eventType);
          });

          if (!hasHandler) {
            errors.push(
              `${consumer} claims to handle "${event.eventType}" but no handler in ${expectedPath}`
            );
          }
        }
      }

      if (errors.length > 0) {
        fail(`Handler location mismatch:\n${errors.map(e => `  - ${e}`).join('\n')}`);
      }
    });
  });

  describe('Cross-Domain Boundary', () => {
    
    it('domain events are not imported outside their domain', async () => {
      const domains = ['services', 'contract', 'financial'];
      const errors: string[] = [];

      for (const domain of domains) {
        const domainEventPath = `domains/${domain}/model/events`;
        
        // Find all files outside this domain
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
            errors.push(
              `${file} imports domain events from ${domain} (should use integration events)`
            );
          }
        }
      }

      if (errors.length > 0) {
        fail(`Domain boundary violations:\n${errors.map(e => `  - ${e}`).join('\n')}`);
      }
    });
  });
});
```

#### CI Integration

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  architecture-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:architecture
        name: Run Architecture Tests
```

```json
// package.json
{
  "scripts": {
    "test:architecture": "jest --config jest.architecture.config.js",
    "test:arch": "npm run test:architecture"
  }
}
```

---

### Approach 3: Generated Documentation

**Purpose**: Auto-generate living documentation from the event registry.

#### Catalog Generator

```typescript
// scripts/generate-event-catalog.ts
import * as fs from 'fs';
import * as path from 'path';
import { EventRegistry } from '@/shared/events/registry';

// Import all events to populate registry
import '@/shared/events';

interface CatalogOptions {
  outputDir: string;
  includeSchema: boolean;
  includeMermaid: boolean;
}

async function generateEventCatalog(options: CatalogOptions): Promise<void> {
  const catalog = EventRegistry.getAll();
  const timestamp = new Date().toISOString();

  // Ensure output directory exists
  fs.mkdirSync(options.outputDir, { recursive: true });

  // Generate main catalog
  const markdown = generateMarkdown(catalog, timestamp, options);
  fs.writeFileSync(
    path.join(options.outputDir, 'EVENT_CATALOG.md'),
    markdown
  );

  // Generate Mermaid diagram
  if (options.includeMermaid) {
    const mermaid = generateMermaidDiagram(catalog);
    fs.writeFileSync(
      path.join(options.outputDir, 'event-flow.mermaid'),
      mermaid
    );
  }

  // Generate JSON for tooling
  const json = JSON.stringify(catalog, null, 2);
  fs.writeFileSync(
    path.join(options.outputDir, 'event-catalog.json'),
    json
  );

  console.log(`✅ Event catalog generated at ${options.outputDir}`);
  console.log(`   - ${catalog.length} events documented`);
  console.log(`   - ${catalog.filter(e => e.consumers.length === 0).length} orphan events`);
}

function generateMarkdown(
  catalog: EventMetadata[],
  timestamp: string,
  options: CatalogOptions
): string {
  const orphans = catalog.filter(e => e.consumers.length === 0);
  const deprecated = catalog.filter(e => e.deprecated);

  return `# Event Catalog

> Auto-generated on ${timestamp}  
> Total Events: ${catalog.length} | Orphans: ${orphans.length} | Deprecated: ${deprecated.length}

## Quick Stats

| Metric | Count |
|--------|-------|
| Total Events | ${catalog.length} |
| Active Events | ${catalog.length - deprecated.length} |
| Orphan Events (no consumers) | ${orphans.length} |
| Deprecated Events | ${deprecated.length} |

---

## Events by Producer

${generateByProducerSection(catalog)}

---

## Events by Consumer

${generateByConsumerSection(catalog)}

---

## Dependency Matrix

| Event | Version | Producers | Consumers | Status |
|-------|---------|-----------|-----------|--------|
${catalog
  .sort((a, b) => a.eventType.localeCompare(b.eventType))
  .map(e => {
    const status = e.deprecated ? '⚠️ Deprecated' : e.consumers.length === 0 ? '🔴 Orphan' : '✅ Active';
    return `| \`${e.eventType}\` | ${e.version} | ${e.producers.join(', ')} | ${e.consumers.join(', ') || '-'} | ${status} |`;
  })
  .join('\n')}

---

## Event Details

${catalog.map(e => generateEventDetail(e, options)).join('\n\n---\n\n')}

---

## Warnings & Issues

${generateWarningsSection(catalog)}
`;
}

function generateByProducerSection(catalog: EventMetadata[]): string {
  const byProducer = new Map<string, EventMetadata[]>();
  
  for (const event of catalog) {
    for (const producer of event.producers) {
      if (!byProducer.has(producer)) {
        byProducer.set(producer, []);
      }
      byProducer.get(producer)!.push(event);
    }
  }

  return Array.from(byProducer.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([producer, events]) => `
### ${producer}

${events.map(e => `- \`${e.eventType}\` (v${e.version})`).join('\n')}
`).join('\n');
}

function generateByConsumerSection(catalog: EventMetadata[]): string {
  const byConsumer = new Map<string, EventMetadata[]>();
  
  for (const event of catalog) {
    for (const consumer of event.consumers) {
      if (!byConsumer.has(consumer)) {
        byConsumer.set(consumer, []);
      }
      byConsumer.get(consumer)!.push(event);
    }
  }

  return Array.from(byConsumer.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([consumer, events]) => `
### ${consumer}

${events.map(e => `- \`${e.eventType}\` (v${e.version})`).join('\n')}
`).join('\n');
}

function generateEventDetail(event: EventMetadata, options: CatalogOptions): string {
  let detail = `
### \`${event.eventType}\`

${event.description || '_No description provided_'}

| Property | Value |
|----------|-------|
| Version | ${event.version} |
| Producers | ${event.producers.join(', ')} |
| Consumers | ${event.consumers.join(', ') || '_None_'} |
| Status | ${event.deprecated ? `⚠️ Deprecated: ${event.deprecationMessage}` : '✅ Active'} |
`;

  if (options.includeSchema && event.schema) {
    detail += `
#### Schema

\`\`\`typescript
${JSON.stringify(event.schema, null, 2)}
\`\`\`
`;
  }

  return detail;
}

function generateWarningsSection(catalog: EventMetadata[]): string {
  const warnings: string[] = [];

  const orphans = catalog.filter(e => e.consumers.length === 0 && !e.deprecated);
  if (orphans.length > 0) {
    warnings.push(`
### 🔴 Orphan Events

These events are published but have no consumers:

${orphans.map(e => `- \`${e.eventType}\` (produced by ${e.producers.join(', ')})`).join('\n')}
`);
  }

  const deprecated = catalog.filter(e => e.deprecated && e.consumers.length > 0);
  if (deprecated.length > 0) {
    warnings.push(`
### ⚠️ Deprecated Events Still in Use

${deprecated.map(e => `- \`${e.eventType}\` consumed by ${e.consumers.join(', ')}`).join('\n')}
`);
  }

  return warnings.length > 0 ? warnings.join('\n') : '_No warnings_';
}

function generateMermaidDiagram(catalog: EventMetadata[]): string {
  let diagram = `%%{init: {'theme': 'base', 'themeVariables': { 'fontSize': '14px'}}}%%
flowchart LR
  subgraph Producers
`;

  const producers = new Set<string>();
  const consumers = new Set<string>();
  
  for (const event of catalog) {
    event.producers.forEach(p => producers.add(p));
    event.consumers.forEach(c => consumers.add(c));
  }

  producers.forEach(p => {
    diagram += `    ${p.replace('Module', '')}[${p}]\n`;
  });

  diagram += `  end\n\n  subgraph Consumers\n`;

  consumers.forEach(c => {
    diagram += `    ${c.replace('Module', '')}[${c}]\n`;
  });

  diagram += `  end\n\n`;

  for (const event of catalog) {
    for (const producer of event.producers) {
      for (const consumer of event.consumers) {
        const pName = producer.replace('Module', '');
        const cName = consumer.replace('Module', '');
        const eventName = event.eventType.split('.').pop();
        diagram += `  ${pName} -->|${eventName}| ${cName}\n`;
      }
    }
  }

  return diagram;
}

// Run generator
generateEventCatalog({
  outputDir: 'docs/events',
  includeSchema: true,
  includeMermaid: true,
});
```

#### Sample Output

```markdown
# Event Catalog

> Auto-generated on 2024-01-15T10:30:00Z  
> Total Events: 12 | Orphans: 1 | Deprecated: 2

## Events by Producer

### ServicesModule

- `services.session.completed` (v1.0)
- `services.session.scheduled` (v1.0)
- `services.enrollment.created` (v1.0)

### ContractModule

- `contract.signed` (v1.0)
- `contract.terminated` (v1.0)
```

---

### Approach 4: Runtime Verification

**Purpose**: Defense-in-depth validation during development and production.

#### Verified Event Bus

```typescript
// infrastructure/eventing/verified-event-bus.ts
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventRegistry } from '@/shared/events/registry';
import { ConfigService } from '@nestjs/config';

export class EventSchemaValidationError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly validationErrors: any
  ) {
    super(`Schema validation failed for event: ${eventType}`);
    this.name = 'EventSchemaValidationError';
  }
}

export class UnauthorizedProducerError extends Error {
  constructor(
    public readonly eventType: string,
    public readonly producer: string
  ) {
    super(`${producer} is not authorized to produce ${eventType}`);
    this.name = 'UnauthorizedProducerError';
  }
}

@Injectable()
export class VerifiedEventBus {
  private readonly logger = new Logger(VerifiedEventBus.name);
  private readonly strictMode: boolean;

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {
    this.strictMode = this.configService.get('NODE_ENV') === 'development';
  }

  async publish<T>(
    event: { eventType: string; payload: T },
    producerModule: string
  ): Promise<void> {
    const meta = EventRegistry.get(event.eventType);

    // Check 1: Event must be registered
    if (!meta) {
      const error = `Attempted to publish unknown event: ${event.eventType}`;
      if (this.strictMode) {
        throw new Error(error);
      }
      this.logger.error(error);
      return;
    }

    // Check 2: Producer must be authorized
    if (!meta.producers.includes(producerModule)) {
      const error = `${producerModule} is not a declared producer of ${event.eventType}`;
      if (this.strictMode) {
        throw new UnauthorizedProducerError(event.eventType, producerModule);
      }
      this.logger.warn(error);
    }

    // Check 3: Payload must match schema
    if (meta.schema) {
      const result = meta.schema.safeParse(event.payload);
      if (!result.success) {
        const error = new EventSchemaValidationError(
          event.eventType,
          result.error.format()
        );
        if (this.strictMode) {
          throw error;
        }
        this.logger.error(`Schema validation failed for ${event.eventType}`, result.error);
      }
    }

    // Check 4: Warn if no consumers
    if (meta.consumers.length === 0) {
      this.logger.warn(`Publishing orphan event: ${event.eventType} (no consumers registered)`);
    }

    // Emit the event
    await this.eventEmitter.emitAsync(event.eventType, event);
    
    this.logger.debug(`Published ${event.eventType} from ${producerModule}`);
  }
}
```

#### Usage with Verified Bus

```typescript
// domains/services/application/session.service.ts
@Injectable()
export class SessionService {
  private readonly MODULE_NAME = 'ServicesModule';

  constructor(private readonly eventBus: VerifiedEventBus) {}

  async completeSession(sessionId: string): Promise<void> {
    // ... business logic ...

    await this.eventBus.publish(
      new SessionCompletedEvent({
        sessionId,
        completedAt: new Date().toISOString(),
        // ...
      }),
      this.MODULE_NAME  // Self-identify as producer
    );
  }
}
```

---

## Industry Best Practices

| Practice | Tools/Patterns | Best For |
|----------|----------------|----------|
| **Schema Registry** | Confluent Schema Registry, AWS Glue | Kafka-based systems, large scale |
| **AsyncAPI Spec** | AsyncAPI + code generation | API-first teams, external consumers |
| **Event Catalog** | eventcatalog.dev | Documentation-focused organizations |
| **Architecture Tests** | ArchUnit, custom Jest tests | Monorepo, CI enforcement |
| **Contract Testing** | Pact, Spring Cloud Contract | Distributed teams, microservices |
| **OpenTelemetry** | Jaeger, Zipkin | Runtime observability |

### Tool Comparison

```
                    ┌─────────────────────────────────────────────────────┐
                    │              Event Governance Spectrum               │
                    ├─────────────────────────────────────────────────────┤
                    │                                                     │
  Compile-Time      │  Decorators ──── Arch Tests ──── AsyncAPI           │
  (Static)          │       │              │              │               │
                    │       │              │              │               │
                    │       ▼              ▼              ▼               │
                    │    Registry ──── Generated ──── Schema             │
                    │       │         Catalog       Registry              │
                    │       │              │              │               │
  Runtime           │       └──────────────┴──────────────┘               │
  (Dynamic)         │                      │                              │
                    │                      ▼                              │
                    │              Verified Event Bus                     │
                    │                      │                              │
                    │                      ▼                              │
                    │              OpenTelemetry / APM                    │
                    │                                                     │
                    └─────────────────────────────────────────────────────┘
```

---

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [ ] Set up event registry infrastructure
- [ ] Create decorator functions
- [ ] Migrate existing events to use `@IntegrationEvent` decorator
- [ ] Add `@HandlesEvent` to all event handlers

**Deliverables:**
- `shared/events/registry/` module
- All events annotated with metadata

### Phase 2: Verification (Week 3)

- [ ] Write architecture test suite
- [ ] Integrate tests into CI pipeline
- [ ] Fix any violations found

**Deliverables:**
- `tests/architecture/event-governance.spec.ts`
- CI workflow configuration
- Zero test failures

### Phase 3: Documentation (Week 4)

- [ ] Create catalog generator script
- [ ] Add to build pipeline (generate on every build)
- [ ] Set up auto-publish to docs site

**Deliverables:**
- `docs/events/EVENT_CATALOG.md`
- `docs/events/event-flow.mermaid`
- Automated documentation updates

### Phase 4: Runtime Guards (Week 5)

- [ ] Implement `VerifiedEventBus`
- [ ] Replace direct `EventEmitter2` usage
- [ ] Configure strict mode for development

**Deliverables:**
- `VerifiedEventBus` service
- Refactored producers to use verified bus
- Development-time validation active

### Phase 5: Observability (Future)

- [ ] Add OpenTelemetry tracing to event bus
- [ ] Create dashboard for event flow visualization
- [ ] Set up alerts for orphan events

---

## Appendix: Complete Code Examples

### Full Event Definition Template

```typescript
// shared/events/services/session-completed.event.ts
import { z } from 'zod';
import { IntegrationEvent } from '../registry/decorators';
import { IntegrationEventBase } from '../base/integration-event.base';

// 1. Define the payload schema
export const SessionCompletedPayloadSchema = z.object({
  sessionId: z.string().uuid(),
  serviceId: z.string().uuid(),
  studentId: z.string().uuid(),
  mentorId: z.string().uuid(),
  completedAt: z.string().datetime(),
  durationMinutes: z.number().int().positive(),
  status: z.enum(['completed', 'cancelled', 'no-show']),
  metadata: z.record(z.unknown()).optional(),
});

// 2. Export the inferred type
export type SessionCompletedPayload = z.infer<typeof SessionCompletedPayloadSchema>;

// 3. Define the event class with decorator
@IntegrationEvent({
  type: 'services.session.completed',
  version: '1.0',
  producers: ['ServicesModule'],
  description: 'Emitted when a tutoring session reaches a terminal state',
})
export class SessionCompletedEvent extends IntegrationEventBase<SessionCompletedPayload> {
  static readonly schema = SessionCompletedPayloadSchema;
  static readonly eventType = 'services.session.completed';

  constructor(payload: SessionCompletedPayload) {
    super('services.session.completed', payload);
  }
}
```

### Full Handler Template

```typescript
// application/event-handlers/financial/session-events.handler.ts
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { HandlesEvent } from '@/shared/events/registry/decorators';
import { 
  SessionCompletedEvent,
  SessionCompletedPayload 
} from '@/shared/events/services/session-completed.event';
import { BillingService } from '@/domains/financial/application/billing.service';

@Injectable()
export class FinancialSessionEventHandlers {
  private readonly logger = new Logger(FinancialSessionEventHandlers.name);

  constructor(private readonly billingService: BillingService) {}

  @OnEvent(SessionCompletedEvent.eventType)
  @HandlesEvent(SessionCompletedEvent.eventType, 'FinancialModule')
  async handleSessionCompleted(event: SessionCompletedEvent): Promise<void> {
    this.logger.log(`Processing session completion: ${event.payload.sessionId}`);

    try {
      await this.billingService.processSessionCompletion({
        sessionId: event.payload.sessionId,
        durationMinutes: event.payload.durationMinutes,
        status: event.payload.status,
      });
    } catch (error) {
      this.logger.error(
        `Failed to process session ${event.payload.sessionId}`,
        error.stack
      );
      throw error; // Re-throw for retry handling
    }
  }
}
```

---

## References

- [Event-Driven Architecture Patterns](https://microservices.io/patterns/data/event-driven-architecture.html)
- [AsyncAPI Specification](https://www.asyncapi.com/)
- [Event Catalog](https://www.eventcatalog.dev/)
- [Domain-Driven Design Reference](https://www.domainlanguage.com/ddd/reference/)
- [NestJS Event Emitter](https://docs.nestjs.com/techniques/events)
