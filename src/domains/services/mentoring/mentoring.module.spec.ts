import { Test, TestingModule } from "@nestjs/testing";
import { MentoringModule } from "./mentoring.module";
import { MentoringService } from "./services/mentoring.service";
import { MentoringEventListener } from "./listeners/mentoring-event.listener";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";

describe("MentoringModule", () => {
  let module: TestingModule;
  let mockDb: any;

  beforeEach(async () => {
    // Create mock database
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      returning: jest.fn(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
    };

    module = await Test.createTestingModule({
      providers: [
        MentoringService,
        MentoringEventListener,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();
  });

  it("should be defined", () => {
    expect(module).toBeDefined();
  });

  it("should provide MentoringService", () => {
    const service = module.get<MentoringService>(MentoringService);
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(MentoringService);
  });

  it("should provide MentoringEventListener", () => {
    const listener = module.get<MentoringEventListener>(
      MentoringEventListener,
    );
    expect(listener).toBeDefined();
    expect(listener).toBeInstanceOf(MentoringEventListener);
  });

  it("should export MentoringService", () => {
    const exportedProviders = Reflect.getMetadata(
      "exports",
      MentoringModule,
    ) as any[];

    expect(exportedProviders).toContain(MentoringService);
  });

  it("should wire up dependencies correctly", () => {
    const service = module.get<MentoringService>(MentoringService);
    const listener = module.get<MentoringEventListener>(MentoringEventListener);

    expect(service).toBeDefined();
    expect(listener).toBeDefined();
  });
});

