import { Injectable } from "@nestjs/common";
import { EventEmitterModule, OnEvent } from "@nestjs/event-emitter";
import { Test } from "@nestjs/testing";

import { EventsModule } from "../events.module";
import { EnhancedEventBus } from "./enhanced-event-bus";

@Injectable()
class RecordingListener {
  public readonly received: any[] = [];

  @OnEvent("session.booked")
  handle(payload: any): void {
    this.received.push(payload);
  }
}

@Injectable()
class ParentChainListener {
  constructor(private readonly bus: EnhancedEventBus) {}

  public parentMetadata: ReturnType<typeof EnhancedEventBus.extractMetadata>;

  @OnEvent("session.booked")
  handle(payload: any): void {
    this.parentMetadata = EnhancedEventBus.extractMetadata(payload);
    this.bus.emitSync("meeting.lifecycle.completed", { nested: true }, { producer: "ChildEmitter" });
  }
}

@Injectable()
class ChildChainListener {
  public childMetadata: ReturnType<typeof EnhancedEventBus.extractMetadata>;

  @OnEvent("meeting.lifecycle.completed")
  handle(payload: any): void {
    this.childMetadata = EnhancedEventBus.extractMetadata(payload);
  }
}

@Injectable()
class UnknownEventListener {
  public hits = 0;

  @OnEvent("unknown.event")
  handle(): void {
    this.hits += 1;
  }
}

describe("EnhancedEventBus (integration)", () => {
  it("emits to existing @OnEvent handlers and attaches metadata", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), EventsModule.forRoot()],
      providers: [RecordingListener],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    try {
      const bus = app.get(EnhancedEventBus);
      const listener = app.get(RecordingListener);

      const result = await bus.emit(
        "session.booked",
        { foo: "bar" },
        { producer: "TestProducer" },
      );

      expect(result.success).toBe(true);
      expect(listener.received).toHaveLength(1);
      expect(listener.received[0]).toMatchObject({ foo: "bar" });

      const metadata = EnhancedEventBus.extractMetadata(listener.received[0]);
      expect(metadata).toBeDefined();
      expect(metadata?.correlationId).toBe(result.correlationId);
      expect(metadata?.rootCorrelationId).toBe(result.correlationId);
      expect(metadata?.causationId).toBeUndefined();
      expect(metadata?.depth).toBe(0);
      expect(metadata?.producer).toBe("TestProducer");
    } finally {
      await app.close();
    }
  });

  it("creates a causation chain when emitting from within a handler", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [EventEmitterModule.forRoot(), EventsModule.forRoot()],
      providers: [ParentChainListener, ChildChainListener],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    try {
      const bus = app.get(EnhancedEventBus);
      const parentListener = app.get(ParentChainListener);
      const childListener = app.get(ChildChainListener);

      const result = await bus.emit(
        "session.booked",
        { foo: "bar" },
        { producer: "ParentEmitter" },
      );

      expect(result.success).toBe(true);

      const parent = parentListener.parentMetadata;
      const child = childListener.childMetadata;

      expect(parent).toBeDefined();
      expect(child).toBeDefined();

      expect(parent?.correlationId).toBe(result.correlationId);
      expect(parent?.rootCorrelationId).toBe(result.correlationId);
      expect(parent?.causationId).toBeUndefined();
      expect(parent?.depth).toBe(0);

      expect(child?.correlationId).toBeDefined();
      expect(child?.correlationId).not.toBe(parent?.correlationId);
      expect(child?.rootCorrelationId).toBe(parent?.rootCorrelationId);
      expect(child?.causationId).toBe(parent?.correlationId);
      expect(child?.depth).toBe(1);
      expect(child?.producer).toBe("ChildEmitter");

      const stats = bus.getStats();
      expect(stats.activeFlows).toBe(0);
      expect(stats.completedFlows).toBe(1);
      expect(stats.totalEvents).toBe(2);
    } finally {
      await app.close();
    }
  });

  it("fails fast on unknown events when strict validation is enabled", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        EventEmitterModule.forRoot(),
        EventsModule.forRoot({ strictValidation: true }),
      ],
      providers: [UnknownEventListener],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.init();

    try {
      const bus = app.get(EnhancedEventBus);
      const listener = app.get(UnknownEventListener);

      const result = await bus.emit("unknown.event", { a: 1 });

      expect(result.success).toBe(false);
      expect(result.validation?.valid).toBe(false);
      expect(result.validation?.errors.join(" ")).toContain(
        "not found in catalog",
      );
      expect(listener.hits).toBe(0);
    } finally {
      await app.close();
    }
  });
});
