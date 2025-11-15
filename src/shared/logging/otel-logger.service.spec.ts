import { Test, TestingModule } from '@nestjs/testing';
import { OtelLoggerService } from './otel-logger.service';
import { logs, SeverityNumber } from '@opentelemetry/api-logs';
import { trace, context } from '@opentelemetry/api';

// Mock OpenTelemetry modules
jest.mock('@opentelemetry/api-logs');
jest.mock('@opentelemetry/api');

describe('OtelLoggerService', () => {
  let service: OtelLoggerService;
  let mockOtelLogger: any;
  let mockEmit: jest.Mock;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock emit function
    mockEmit = jest.fn();

    // Mock logger instance
    mockOtelLogger = {
      emit: mockEmit,
    };

    // Mock logs.getLogger to return our mock logger
    (logs.getLogger as jest.Mock).mockReturnValue(mockOtelLogger);

    // Mock trace functions
    (trace.getActiveSpan as jest.Mock).mockReturnValue(null);
    (trace.setSpan as jest.Mock).mockImplementation((ctx, span) => ctx);
    (trace.wrapSpanContext as jest.Mock).mockImplementation((spanCtx) => spanCtx);

    // Mock context
    (context.active as jest.Mock).mockReturnValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [OtelLoggerService],
    }).compile();

    service = module.get<OtelLoggerService>(OtelLoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Constructor', () => {
    it('should initialize with logs.getLogger', () => {
      expect(logs.getLogger).toHaveBeenCalledWith('sa2-mvp-logger');
    });

    it('should support creating with context string', () => {
      const contextService = new OtelLoggerService('TestContext');
      expect(contextService).toBeDefined();
    });

    it('should support creating with options', () => {
      const optionsService = new OtelLoggerService({ logLevels: ['error', 'warn'] });
      expect(optionsService).toBeDefined();
    });
  });

  describe('mapSeverity', () => {
    it('should map "fatal" to FATAL severity', () => {
      service.fatal('test message');
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          severityNumber: SeverityNumber.FATAL,
          severityText: 'FATAL',
        }),
      );
    });

    it('should map "error" to ERROR severity', () => {
      service.error('test error');
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          severityNumber: SeverityNumber.ERROR,
          severityText: 'ERROR',
        }),
      );
    });

    it('should map "warn" to WARN severity', () => {
      service.warn('test warning');
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          severityNumber: SeverityNumber.WARN,
          severityText: 'WARN',
        }),
      );
    });

    it('should map "log" to INFO severity', () => {
      service.log('test log');
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          severityNumber: SeverityNumber.INFO,
          severityText: 'LOG',
        }),
      );
    });

    it('should map "debug" to DEBUG severity', () => {
      service.debug('test debug');
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          severityNumber: SeverityNumber.DEBUG,
          severityText: 'DEBUG',
        }),
      );
    });

    it('should map "verbose" to TRACE severity', () => {
      service.verbose('test verbose');
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          severityNumber: SeverityNumber.TRACE,
          severityText: 'VERBOSE',
        }),
      );
    });
  });

  describe('emitOtelLog', () => {
    it('should emit log with string message', () => {
      service.log('Simple message');

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Simple message',
          severityNumber: SeverityNumber.INFO,
          severityText: 'LOG',
        }),
      );
    });

    it('should emit log with Error object', () => {
      const error = new Error('Test error message');
      error.stack = 'Error: Test error message\n  at TestFunction';

      service.error(error);

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Test error message',
          attributes: expect.objectContaining({
            'exception.type': 'Error',
            'exception.message': 'Test error message',
            'exception.stacktrace': error.stack,
          }),
        }),
      );
    });

    it('should emit log with object message', () => {
      const obj = { userId: '123', action: 'login' };
      service.log(obj);

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          body: JSON.stringify(obj),
        }),
      );
    });

    it('should include logger context in attributes', () => {
      const contextService = new OtelLoggerService('AuthService');
      contextService.log('test');

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({
            'logger.context': 'AuthService',
          }),
        }),
      );
    });

    it('should include optional param count in attributes', () => {
      service.log('Message with params', 'param1', 'param2');

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({
            'logger.optional_param_count': expect.any(Number),
          }),
        }),
      );
    });

    it('should include trace context when span is active', () => {
      const mockSpan = {
        spanContext: jest.fn().mockReturnValue({
          traceId: '1234567890abcdef1234567890abcdef',
          spanId: '1234567890abcdef',
        }),
      };
      (trace.getActiveSpan as jest.Mock).mockReturnValue(mockSpan);

      service.log('test with trace');

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({
            traceId: '1234567890abcdef1234567890abcdef',
            spanId: '1234567890abcdef',
          }),
        }),
      );
    });

    it('should handle emit failures gracefully', () => {
      mockEmit.mockImplementation(() => {
        throw new Error('OTLP export failed');
      });

      // Should not throw
      expect(() => service.log('test')).not.toThrow();
    });

    it('should log emit failures when OTEL_LOG_LEVEL=DEBUG', () => {
      const originalEnv = process.env.OTEL_LOG_LEVEL;
      process.env.OTEL_LOG_LEVEL = 'DEBUG';
      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

      mockEmit.mockImplementation(() => {
        throw new Error('Export error');
      });

      service.log('test');

      expect(consoleDebugSpy).toHaveBeenCalledWith(
        '[OtelLogger] Failed to emit log to OTLP:',
        'Export error',
      );

      consoleDebugSpy.mockRestore();
      process.env.OTEL_LOG_LEVEL = originalEnv;
    });

    it('should not log emit failures when OTEL_LOG_LEVEL is not DEBUG', () => {
      const originalEnv = process.env.OTEL_LOG_LEVEL;
      process.env.OTEL_LOG_LEVEL = 'INFO';
      const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();

      mockEmit.mockImplementation(() => {
        throw new Error('Export error');
      });

      service.log('test');

      expect(consoleDebugSpy).not.toHaveBeenCalled();

      consoleDebugSpy.mockRestore();
      process.env.OTEL_LOG_LEVEL = originalEnv;
    });
  });

  describe('formatForSpan', () => {
    it('should return string as-is', () => {
      service.log('test string');
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'test string',
        }),
      );
    });

    it('should return error message for Error objects', () => {
      const error = new Error('Test error');
      service.error(error);
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'Test error',
        }),
      );
    });

    it('should stringify objects', () => {
      const obj = { key: 'value' };
      service.log(obj);
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          body: JSON.stringify(obj),
        }),
      );
    });

    it('should handle undefined', () => {
      service.log(undefined);
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          body: 'undefined',
        }),
      );
    });

    it('should handle null', () => {
      service.log(null);
      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          body: expect.any(String),
        }),
      );
    });

    it('should convert non-serializable objects to string', () => {
      const circular: any = { name: 'circular' };
      circular.self = circular;

      // Should not throw
      expect(() => service.log(circular)).not.toThrow();
    });
  });

  describe('extractError', () => {
    it('should extract Error from message', () => {
      const error = new Error('Message error');
      service.error(error);

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({
            'exception.type': 'Error',
            'exception.message': 'Message error',
          }),
        }),
      );
    });

    it('should extract Error from optional params', () => {
      const error = new Error('Param error');
      service.error('Error occurred', error);

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.objectContaining({
            'exception.type': 'Error',
            'exception.message': 'Param error',
          }),
        }),
      );
    });

    it('should not add exception attributes when no error is present', () => {
      service.log('Normal log');

      expect(mockEmit).toHaveBeenCalledWith(
        expect.objectContaining({
          attributes: expect.not.objectContaining({
            'exception.type': expect.anything(),
          }),
        }),
      );
    });
  });

  describe('Integration with ConsoleLogger', () => {
    it('should call parent log method', () => {
      const logSpy = jest.spyOn(OtelLoggerService.prototype as any, 'logInternal');
      service.log('test');
      expect(logSpy).toHaveBeenCalled();
      logSpy.mockRestore();
    });

    it('should preserve context parameter', () => {
      // This should not throw and should handle the context properly
      expect(() => service.log('Message', 'ContextName')).not.toThrow();
    });

    it('should preserve stack trace for errors', () => {
      // This should not throw and should handle stack traces
      expect(() => service.error('Error message', 'stack trace', 'ContextName')).not.toThrow();
    });
  });
});
