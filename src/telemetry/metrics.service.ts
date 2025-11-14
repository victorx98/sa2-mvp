import { Injectable } from '@nestjs/common';
import { metrics, Counter, Histogram, UpDownCounter } from '@opentelemetry/api';

/**
 * Service for recording business metrics using OpenTelemetry
 *
 * Provides a simple interface for tracking key business KPIs:
 * - Counters: Monotonically increasing values (e.g., total bookings)
 * - Histograms: Distribution of values (e.g., booking duration)
 * - UpDownCounters: Values that can increase or decrease (e.g., active sessions)
 */
@Injectable()
export class MetricsService {
  private readonly meter = metrics.getMeter('mentorx-backend');

  // Booking metrics
  private readonly sessionsBookedCounter: Counter;
  private readonly bookingDurationHistogram: Histogram;
  private readonly bookingFailuresCounter: Counter;

  // Contract metrics
  private readonly contractsCreatedCounter: Counter;
  private readonly contractValueHistogram: Histogram;

  // Payment metrics
  private readonly paymentsProcessedCounter: Counter;
  private readonly paymentAmountHistogram: Histogram;
  private readonly paymentFailuresCounter: Counter;

  // Session metrics
  private readonly sessionsCompletedCounter: Counter;
  private readonly sessionDurationHistogram: Histogram;
  private readonly activeSessionsGauge: UpDownCounter;

  // Service consumption metrics
  private readonly serviceConsumedCounter: Counter;
  private readonly serviceBalanceGauge: UpDownCounter;

  constructor() {
    // Initialize booking metrics
    this.sessionsBookedCounter = this.meter.createCounter('sessions.booked', {
      description: 'Total number of sessions booked',
      unit: 'sessions',
    });

    this.bookingDurationHistogram = this.meter.createHistogram(
      'booking.duration',
      {
        description: 'Duration of booking process',
        unit: 'ms',
      },
    );

    this.bookingFailuresCounter = this.meter.createCounter(
      'booking.failures',
      {
        description: 'Total number of failed booking attempts',
        unit: 'failures',
      },
    );

    // Initialize contract metrics
    this.contractsCreatedCounter = this.meter.createCounter(
      'contracts.created',
      {
        description: 'Total number of contracts created',
        unit: 'contracts',
      },
    );

    this.contractValueHistogram = this.meter.createHistogram(
      'contract.value',
      {
        description: 'Distribution of contract values',
        unit: 'currency',
      },
    );

    // Initialize payment metrics
    this.paymentsProcessedCounter = this.meter.createCounter(
      'payments.processed',
      {
        description: 'Total number of payments processed',
        unit: 'payments',
      },
    );

    this.paymentAmountHistogram = this.meter.createHistogram(
      'payment.amount',
      {
        description: 'Distribution of payment amounts',
        unit: 'currency',
      },
    );

    this.paymentFailuresCounter = this.meter.createCounter(
      'payment.failures',
      {
        description: 'Total number of failed payment attempts',
        unit: 'failures',
      },
    );

    // Initialize session metrics
    this.sessionsCompletedCounter = this.meter.createCounter(
      'sessions.completed',
      {
        description: 'Total number of completed sessions',
        unit: 'sessions',
      },
    );

    this.sessionDurationHistogram = this.meter.createHistogram(
      'session.duration',
      {
        description: 'Distribution of session durations',
        unit: 'minutes',
      },
    );

    this.activeSessionsGauge = this.meter.createUpDownCounter(
      'sessions.active',
      {
        description: 'Number of currently active sessions',
        unit: 'sessions',
      },
    );

    // Initialize service consumption metrics
    this.serviceConsumedCounter = this.meter.createCounter(
      'service.consumed',
      {
        description: 'Total service units consumed',
        unit: 'units',
      },
    );

    this.serviceBalanceGauge = this.meter.createUpDownCounter(
      'service.balance',
      {
        description: 'Current service balance for students',
        unit: 'units',
      },
    );
  }

  // Booking metrics methods
  recordSessionBooked(attributes?: Record<string, string | number>): void {
    this.sessionsBookedCounter.add(1, attributes);
  }

  recordBookingDuration(
    durationMs: number,
    attributes?: Record<string, string | number>,
  ): void {
    this.bookingDurationHistogram.record(durationMs, attributes);
  }

  recordBookingFailure(
    reason: string,
    attributes?: Record<string, string | number>,
  ): void {
    this.bookingFailuresCounter.add(1, {
      ...attributes,
      failure_reason: reason,
    });
  }

  // Contract metrics methods
  recordContractCreated(
    value: number,
    attributes?: Record<string, string | number>,
  ): void {
    this.contractsCreatedCounter.add(1, attributes);
    this.contractValueHistogram.record(value, attributes);
  }

  // Payment metrics methods
  recordPaymentProcessed(
    amount: number,
    attributes?: Record<string, string | number>,
  ): void {
    this.paymentsProcessedCounter.add(1, attributes);
    this.paymentAmountHistogram.record(amount, attributes);
  }

  recordPaymentFailure(
    reason: string,
    attributes?: Record<string, string | number>,
  ): void {
    this.paymentFailuresCounter.add(1, {
      ...attributes,
      failure_reason: reason,
    });
  }

  // Session metrics methods
  recordSessionCompleted(
    durationMinutes: number,
    attributes?: Record<string, string | number>,
  ): void {
    this.sessionsCompletedCounter.add(1, attributes);
    this.sessionDurationHistogram.record(durationMinutes, attributes);
  }

  recordActiveSessionChange(
    delta: number,
    attributes?: Record<string, string | number>,
  ): void {
    this.activeSessionsGauge.add(delta, attributes);
  }

  // Service consumption metrics methods
  recordServiceConsumed(
    units: number,
    attributes?: Record<string, string | number>,
  ): void {
    this.serviceConsumedCounter.add(units, attributes);
  }

  recordServiceBalanceChange(
    delta: number,
    attributes?: Record<string, string | number>,
  ): void {
    this.serviceBalanceGauge.add(delta, attributes);
  }

  /**
   * Helper method to time operations and record as histogram
   *
   * @example
   * ```typescript
   * const timer = metricsService.startTimer();
   * await doSomething();
   * timer.end('operation.name', { operation: 'booking' });
   * ```
   */
  startTimer(): { end: (metricName: string, attributes?: Record<string, string | number>) => void } {
    const start = Date.now();
    const histogram = this.meter.createHistogram('operation.duration', {
      description: 'Duration of operations',
      unit: 'ms',
    });

    return {
      end: (metricName?: string, attributes?: Record<string, string | number>) => {
        const duration = Date.now() - start;
        histogram.record(duration, {
          ...attributes,
          operation: metricName || 'unknown',
        });
      },
    };
  }
}
