import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { ZoomMeetingClient } from "./zoom-meeting.client";

describe("ZoomMeetingClient", () => {
  let client: ZoomMeetingClient;
  let configService: ConfigService;

  describe("with valid configuration", () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ZoomMeetingClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === "ZOOM_CLIENT_ID") return "test_client_id";
                if (key === "ZOOM_CLIENT_SECRET") return "test_client_secret";
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      client = module.get<ZoomMeetingClient>(ZoomMeetingClient);
      configService = module.get<ConfigService>(ConfigService);
    });

    it("should be defined", () => {
      expect(client).toBeDefined();
    });

    it("should initialize with correct configuration", () => {
      expect(configService.get).toHaveBeenCalledWith("ZOOM_CLIENT_ID");
      expect(configService.get).toHaveBeenCalledWith("ZOOM_CLIENT_SECRET");
    });

    it("should be injectable as a provider", () => {
      expect(client).toBeInstanceOf(ZoomMeetingClient);
    });

    it("should have access to configuration values", () => {
      // Access private fields through any type for testing
      const clientAny = client as any;
      expect(clientAny.clientId).toBe("test_client_id");
      expect(clientAny.clientSecret).toBe("test_client_secret");
    });
  });

  describe("with missing configuration", () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ZoomMeetingClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn(() => ""), // Return empty strings for all config
            },
          },
        ],
      }).compile();

      client = module.get<ZoomMeetingClient>(ZoomMeetingClient);
      configService = module.get<ConfigService>(ConfigService);
    });

    it("should still be defined even without configuration", () => {
      expect(client).toBeDefined();
    });

    it("should attempt to read configuration", () => {
      expect(configService.get).toHaveBeenCalledWith("ZOOM_CLIENT_ID");
      expect(configService.get).toHaveBeenCalledWith("ZOOM_CLIENT_SECRET");
    });

    it("should set empty strings when configuration is missing", () => {
      const clientAny = client as any;
      expect(clientAny.clientId).toBe("");
      expect(clientAny.clientSecret).toBe("");
    });
  });

  describe("with partial configuration", () => {
    it("should handle missing CLIENT_ID", async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ZoomMeetingClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === "ZOOM_CLIENT_ID") return "";
                if (key === "ZOOM_CLIENT_SECRET") return "test_secret";
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const testClient = module.get<ZoomMeetingClient>(ZoomMeetingClient);
      const testClientAny = testClient as any;

      expect(testClientAny.clientId).toBe("");
      expect(testClientAny.clientSecret).toBe("test_secret");
    });

    it("should handle missing CLIENT_SECRET", async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ZoomMeetingClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === "ZOOM_CLIENT_ID") return "test_id";
                if (key === "ZOOM_CLIENT_SECRET") return "";
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const testClient = module.get<ZoomMeetingClient>(ZoomMeetingClient);
      const testClientAny = testClient as any;

      expect(testClientAny.clientId).toBe("test_id");
      expect(testClientAny.clientSecret).toBe("");
    });
  });

  describe("future implementation readiness", () => {
    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          ZoomMeetingClient,
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string) => {
                if (key === "ZOOM_CLIENT_ID") return "test_client_id";
                if (key === "ZOOM_CLIENT_SECRET") return "test_client_secret";
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      client = module.get<ZoomMeetingClient>(ZoomMeetingClient);
    });

    it("should be ready for dependency injection in adapters", () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(ZoomMeetingClient);
    });

    it("should have logger available for future implementations", () => {
      const clientAny = client as any;
      expect(clientAny.logger).toBeDefined();
    });

    it("should have configService available for future implementations", () => {
      const clientAny = client as any;
      expect(clientAny.configService).toBeDefined();
    });
  });
});
