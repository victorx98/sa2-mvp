# OpenTelemetry Integration Guide

This directory contains OpenTelemetry utilities for distributed tracing and metrics collection.

## Quick Start

### 1. Enable Telemetry

Configure environment variables (see `env.example`):

```bash
OTEL_ENABLED=true
SERVICE_NAME=mentorx-backend
OTEL_EXPORTER_OTLP_ENDPOINT=https://your-collector:4318
```

### 2. Use @Trace Decorator

Automatically create spans for methods:

```typescript
import { Trace, addSpanAttributes, addSpanEvent } from '@shared/decorators/trace.decorator';

@Injectable()
export class MyService {
  @Trace()  // Simple usage - auto-generates span name
  async simpleMethod() {
    // Your code here
  }

  @Trace({
    name: 'custom.span.name',
    attributes: { 'operation.type': 'critical' }
  })
  async complexMethod(userId: string) {
    // Add dynamic attributes during execution
    addSpanAttributes({
      'user.id': userId,
      'processing.step': 'validation'
    });

    // Add events to mark important moments
    addSpanEvent('validation.completed', {
      items_validated: 5
    });

    // Your code here
  }
}
```

### 3. Record Business Metrics

Inject `MetricsService` to track KPIs:

```typescript
import { MetricsService } from '@telemetry/metrics.service';

@Injectable()
export class BookingService {
  constructor(private readonly metricsService: MetricsService) {}

  async createBooking(dto: CreateBookingDto) {
    const startTime = Date.now();

    try {
      // Your booking logic here
      const booking = await this.doBooking(dto);

      // Record success metrics
      const duration = Date.now() - startTime;
      this.metricsService.recordSessionBooked({
        student_id: dto.studentId,
        mentor_id: dto.mentorId
      });
      this.metricsService.recordBookingDuration(duration);

      return booking;
    } catch (error) {
      // Record failure metrics
      this.metricsService.recordBookingFailure(error.message, {
        student_id: dto.studentId
      });
      throw error;
    }
  }
}
```

### 4. Add User Context to HTTP Requests

Apply `TracingInterceptor` to enrich spans with user info:

```typescript
import { TracingInterceptor } from '@shared/interceptors/tracing.interceptor';

// Apply to specific controller
@UseInterceptors(TracingInterceptor)
@Controller('bookings')
export class BookingController {
  // All methods will have user context in spans
}

// Or apply globally in main.ts
app.useGlobalInterceptors(new TracingInterceptor());
```

## Available Metrics

### Booking Metrics

```typescript
// Counter: Total sessions booked
metricsService.recordSessionBooked(attributes);

// Histogram: Booking process duration
metricsService.recordBookingDuration(durationMs, attributes);

// Counter: Booking failures
metricsService.recordBookingFailure(reason, attributes);
```

### Contract Metrics

```typescript
// Counter + Histogram: Contracts created with value
metricsService.recordContractCreated(value, attributes);
```

### Payment Metrics

```typescript
// Counter + Histogram: Payments processed
metricsService.recordPaymentProcessed(amount, attributes);

// Counter: Payment failures
metricsService.recordPaymentFailure(reason, attributes);
```

### Session Metrics

```typescript
// Counter + Histogram: Completed sessions
metricsService.recordSessionCompleted(durationMinutes, attributes);

// UpDownCounter: Active sessions count
metricsService.recordActiveSessionChange(+1, attributes);  // Session started
metricsService.recordActiveSessionChange(-1, attributes);  // Session ended
```

### Service Consumption Metrics

```typescript
// Counter: Service units consumed
metricsService.recordServiceConsumed(units, attributes);

// UpDownCounter: Service balance changes
metricsService.recordServiceBalanceChange(delta, attributes);
```

### Generic Timer

```typescript
const timer = metricsService.startTimer();
await doExpensiveOperation();
timer.end('operation.name', { user_id: '123' });
```

## Best Practices

### 1. Span Naming Convention

Use hierarchical names with dots:

```typescript
@Trace({ name: 'domain.service.operation' })
// Examples:
// - 'booking.session.create'
// - 'payment.transaction.process'
// - 'feishu.meeting.create'
```

### 2. Attribute Naming

Follow OpenTelemetry semantic conventions:

```typescript
addSpanAttributes({
  // Entity IDs
  'user.id': userId,
  'session.id': sessionId,

  // Operations
  'operation.type': 'create',
  'operation.status': 'success',

  // Business context
  'booking.duration': 60,
  'payment.amount': 100,
  'meeting.provider': 'feishu'
});
```

### 3. Use Events for Important Moments

```typescript
addSpanEvent('transaction.started');
// ... do work
addSpanEvent('transaction.committed', { rows_affected: 5 });
```

### 4. Don't Record Sensitive Data

```typescript
// ❌ BAD
@Trace({ recordArguments: true })  // May log passwords, tokens
async login(credentials) { }

// ✅ GOOD
@Trace()
async login(credentials) {
  addSpanAttributes({
    'user.email': credentials.email  // Only non-sensitive data
  });
}
```

### 5. Add Context, Not Noise

```typescript
// ❌ Too much detail
addSpanAttributes({
  'request.header.content_type': 'application/json',
  'request.header.accept': '*/*',
  'request.header.user_agent': '...'
});

// ✅ Relevant context
addSpanAttributes({
  'user.id': userId,
  'booking.count': 3,
  'operation.batch_size': items.length
});
```

## Debugging

### Check Telemetry Status

```typescript
import { getTelemetryStatus } from '@telemetry/opentelemetry';

const status = getTelemetryStatus();
console.log(status);
// {
//   enabled: true,
//   started: true,
//   starting: false,
//   error: null,
//   serviceName: 'mentorx-backend'
// }
```

### Enable Debug Logging

```bash
OTEL_LOG_LEVEL=DEBUG npm run start:dev
```

### Test Locally with Jaeger

```bash
# Run Jaeger all-in-one
docker run -d --name jaeger \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest

# Configure .env
OTEL_ENABLED=true
SERVICE_NAME=mentorx-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# View traces at http://localhost:16686
```

## Architecture

```
src/telemetry/
├── opentelemetry.ts           # SDK initialization & configuration
├── metrics.service.ts         # Business metrics API
├── telemetry.module.ts        # NestJS module (global)
└── README.md                  # This file

src/shared/
├── decorators/
│   └── trace.decorator.ts     # @Trace() decorator + helpers
└── interceptors/
    └── tracing.interceptor.ts # HTTP request context enrichment
```

## What's Instrumented

### Automatic (No Code Changes)

- ✅ HTTP requests (incoming/outgoing)
- ✅ NestJS controllers
- ✅ PostgreSQL queries (via Drizzle ORM)
- ✅ Express middleware

### Manual (Requires @Trace)

- ✅ Booking flow (`BookSessionCommand`)
- ✅ Meeting providers (Zoom, Feishu)
- 📝 Add to other critical services as needed

## Common Patterns

### Pattern 1: Command with Metrics

```typescript
@Injectable()
export class CreateContractCommand {
  constructor(
    private readonly db: DrizzleDatabase,
    private readonly metricsService: MetricsService
  ) {}

  @Trace({ name: 'contract.create' })
  async execute(input: CreateContractInput) {
    const startTime = Date.now();

    addSpanAttributes({
      'student.id': input.studentId,
      'contract.value': input.totalValue
    });

    try {
      const contract = await this.db.transaction(async (tx) => {
        // Transaction logic
        return createdContract;
      });

      // Success metrics
      const duration = Date.now() - startTime;
      this.metricsService.recordContractCreated(contract.totalValue, {
        student_id: input.studentId,
        contract_type: input.type
      });

      return contract;
    } catch (error) {
      // Failure is auto-recorded by @Trace
      throw error;
    }
  }
}
```

### Pattern 2: External Service Call

```typescript
@Injectable()
export class PaymentService {
  @Trace({
    name: 'payment.external.charge',
    attributes: { 'payment.provider': 'stripe' }
  })
  async chargeCustomer(amount: number, customerId: string) {
    addSpanAttributes({
      'payment.amount': amount,
      'customer.id': customerId
    });

    addSpanEvent('payment.request.sent');

    try {
      const result = await this.stripe.charges.create({
        amount,
        customer: customerId
      });

      addSpanEvent('payment.response.received', {
        charge_id: result.id,
        status: result.status
      });

      return result;
    } catch (error) {
      // Error auto-recorded by @Trace
      throw error;
    }
  }
}
```

### Pattern 3: Long-Running Operation

```typescript
@Injectable()
export class ReportService {
  constructor(private readonly metricsService: MetricsService) {}

  @Trace({ name: 'report.generate' })
  async generateMonthlyReport(month: string) {
    const timer = this.metricsService.startTimer();

    try {
      addSpanEvent('report.data_fetch.start');
      const data = await this.fetchData(month);

      addSpanEvent('report.processing.start', {
        row_count: data.length
      });
      const processed = await this.processData(data);

      addSpanEvent('report.export.start');
      const report = await this.exportToFile(processed);

      timer.end('report.generation', {
        report_type: 'monthly',
        row_count: data.length
      });

      return report;
    } catch (error) {
      timer.end('report.generation.failed', {
        error_type: error.constructor.name
      });
      throw error;
    }
  }
}
```

## Next Steps

1. **Add more domain traces**: Apply `@Trace()` to critical domain services
2. **Create dashboards**: Use metrics to build Grafana dashboards
3. **Set up alerts**: Define SLOs and alert on metric thresholds
4. **Sampling strategy**: Configure sampling for high-volume endpoints
5. **Custom propagators**: If using event bus, add context propagation

## Resources

- [OpenTelemetry Docs](https://opentelemetry.io/docs/)
- [Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
- [SETUP.md](../../SETUP.md#opentelemetry-setup-optional) - Configuration guide
