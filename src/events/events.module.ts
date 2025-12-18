/**
 * Events Module
 * 事件模块
 *
 * Central module for the enhanced event-driven architecture.
 * Provides event catalog, enhanced event bus, correlation tracking,
 * and flow monitoring capabilities.
 *
 * 增强事件驱动架构的核心模块。
 * 提供事件目录、增强事件总线、关联追踪和流监控功能。
 *
 * Usage:
 * Import EventsModule.forRoot() in your AppModule to enable enhanced events.
 * 在AppModule中导入EventsModule.forRoot()以启用增强事件。
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     EventEmitterModule.forRoot(),
 *     EventsModule.forRoot(),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */

import {
  Module,
  DynamicModule,
  Global,
  MiddlewareConsumer,
  NestModule,
} from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import {
  CorrelationIdProvider,
  CorrelationIdMiddleware,
} from "./infrastructure/correlation-id.provider";
import { EventFlowTracker } from "./infrastructure/event-flow-context";
import { EnhancedEventBus } from "./infrastructure/enhanced-event-bus";
import { SagaOrchestrator } from "./sagas/saga-orchestrator";

/**
 * Configuration options for the Events module
 * 事件模块的配置选项
 */
export interface EventsModuleOptions {
  /**
   * Enable strict event validation (fail on unknown events)
   * 启用严格事件验证（对未知事件失败）
   * @default false
   */
  strictValidation?: boolean;

  /**
   * Enable event flow tracking
   * 启用事件流追踪
   * @default true
   */
  enableTracking?: boolean;

  /**
   * Events to skip tracking for (high-frequency events)
   * 跳过追踪的事件（高频事件）
   * @default []
   */
  skipTrackingEvents?: string[];

  /**
   * Enable correlation ID middleware for HTTP requests
   * 为HTTP请求启用关联ID中间件
   * @default true
   */
  enableCorrelationMiddleware?: boolean;

  /**
   * Routes to exclude from correlation middleware
   * 从关联中间件排除的路由
   * @default []
   */
  excludeRoutes?: string[];
}

const DEFAULT_OPTIONS: EventsModuleOptions = {
  strictValidation: false,
  enableTracking: true,
  skipTrackingEvents: [],
  enableCorrelationMiddleware: true,
  excludeRoutes: [],
};

/**
 * Events Module
 * Provides enhanced event-driven architecture components
 * 提供增强的事件驱动架构组件
 */
@Global()
@Module({})
export class EventsModule implements NestModule {
  private static options: EventsModuleOptions = DEFAULT_OPTIONS;

  /**
   * Configure the Events module with options
   * 使用选项配置事件模块
   *
   * @param options - Module configuration options
   * @returns Dynamic module configuration
   */
  static forRoot(options: EventsModuleOptions = {}): DynamicModule {
    EventsModule.options = { ...DEFAULT_OPTIONS, ...options };

    return {
      module: EventsModule,
      imports: [],
      providers: [
        // Correlation ID Provider
        {
          provide: CorrelationIdProvider,
          useClass: CorrelationIdProvider,
        },
        // Event Flow Tracker
        {
          provide: EventFlowTracker,
          useClass: EventFlowTracker,
        },
        // Enhanced Event Bus with configuration
        {
          provide: EnhancedEventBus,
          useFactory: (
            correlationProvider: CorrelationIdProvider,
            flowTracker: EventFlowTracker,
            eventEmitter: EventEmitter2,
          ) => {
            const bus = new EnhancedEventBus(
              eventEmitter,
              correlationProvider,
              flowTracker,
            );

            // Apply configuration
            if (EventsModule.options.strictValidation) {
              bus.setStrictValidation(true);
            }

            if (!EventsModule.options.enableTracking) {
              bus.setTrackingEnabled(false);
            }

            if (
              EventsModule.options.skipTrackingEvents &&
              EventsModule.options.skipTrackingEvents.length > 0
            ) {
              bus.skipTrackingFor(EventsModule.options.skipTrackingEvents);
            }

            return bus;
          },
          inject: [CorrelationIdProvider, EventFlowTracker, EventEmitter2],
        },
        // Saga Orchestrator
        {
          provide: SagaOrchestrator,
          useFactory: (
            eventEmitter: EventEmitter2,
            correlationProvider: CorrelationIdProvider,
            flowTracker: EventFlowTracker,
          ) => {
            return new SagaOrchestrator(
              eventEmitter,
              correlationProvider,
              flowTracker,
            );
          },
          inject: [EventEmitter2, CorrelationIdProvider, EventFlowTracker],
        },
      ],
      exports: [
        CorrelationIdProvider,
        EventFlowTracker,
        EnhancedEventBus,
        SagaOrchestrator,
      ],
    };
  }

  /**
   * Configure middleware
   * 配置中间件
   */
  configure(consumer: MiddlewareConsumer): void {
    if (EventsModule.options.enableCorrelationMiddleware) {
      const excludeRoutes = EventsModule.options.excludeRoutes || [];

      consumer
        .apply(CorrelationIdMiddleware)
        .exclude(...excludeRoutes)
        .forRoutes("*");
    }
  }
}

/**
 * Lightweight module for feature modules that need access to event services
 * 需要访问事件服务的功能模块的轻量级模块
 *
 * Use this in feature modules instead of importing EventsModule.forRoot() again.
 * 在功能模块中使用此模块，而不是再次导入EventsModule.forRoot()。
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [EventsFeatureModule],
 * })
 * export class MyFeatureModule {}
 * ```
 */
@Module({
  providers: [CorrelationIdProvider, EventFlowTracker],
  exports: [CorrelationIdProvider, EventFlowTracker],
})
export class EventsFeatureModule {}
