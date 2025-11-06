import { JwtStrategy } from "./jwt.strategy";
import { ConfigService } from "@nestjs/config";
import { AuthCommandService } from "@application/commands/auth-command/auth-command.service";

describe("JwtStrategy", () => {
  let strategy: JwtStrategy;
  let configService: ConfigService;
  let authCommandService: AuthCommandService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === "JWT_SECRET") return "test-secret";
        return null;
      }),
    } as any;

    authCommandService = {
      validateUser: jest.fn().mockResolvedValue({
        id: "user-id-123",
        email: "test@example.com",
        nickname: "Test User",
      }),
    } as any;

    strategy = new JwtStrategy(configService, authCommandService);
  });

  describe("validate", () => {
    it("should return user object with sub and email", async () => {
      const payload = { sub: "user-id-123", email: "test@example.com" };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: payload.sub,
        email: payload.email,
        id: "user-id-123",
        nickname: "Test User",
      });
      expect(authCommandService.validateUser).toHaveBeenCalledWith(payload.sub);
    });

    it("should handle payload with additional fields", async () => {
      const payload = {
        sub: "user-id-456",
        email: "test@example.com",
        iat: 1234567890,
        exp: 1234567890,
      };

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: payload.sub,
        email: payload.email,
        id: "user-id-123",
        nickname: "Test User",
      });
      expect(authCommandService.validateUser).toHaveBeenCalledWith(payload.sub);
    });
  });
});
