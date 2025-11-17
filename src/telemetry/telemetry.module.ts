import { Module, Global } from '@nestjs/common';
import { MetricsService } from './metrics.service';

/**
 * Global module providing OpenTelemetry utilities
 *
 * Exports:
 * - MetricsService: For recording business metrics
 *
 * This module is marked as @Global() so MetricsService can be injected
 * anywhere without importing the module explicitly
 */
@Global()
@Module({
  providers: [MetricsService],
  exports: [MetricsService],
})
export class TelemetryModule {}
