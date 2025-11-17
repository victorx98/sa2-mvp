import { Reflector } from "@nestjs/core";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { SupabaseAuthService } from "@infrastructure/auth/supabase-auth.service";
import type { IUserService } from "@domains/identity/user/user-interface";

const createExecutionContext = (request: any): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => request,
    }),
    getHandler: jest.fn(),
    getClass: jest.fn(),
  }) as unknown as ExecutionContext;

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let supabaseAuthService: jest.Mocked<SupabaseAuthService>;
  let userService: jest.Mocked<IUserService>;

  beforeEach(() => {
    reflector = new Reflector();
    supabaseAuthService = {
      getUserByToken: jest.fn(),
    } as unknown as jest.Mocked<SupabaseAuthService>;

    userService = {
      findByIdWithRoles: jest.fn(),
    } as unknown as jest.Mocked<IUserService>;

    guard = new JwtAuthGuard(reflector, userService, supabaseAuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("should allow public routes", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(true);
    const context = createExecutionContext({});

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it("should throw UnauthorizedException when token is missing", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);
    const context = createExecutionContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("should attach user to request when token is valid", async () => {
    jest.spyOn(reflector, "getAllAndOverride").mockReturnValue(false);

    const request: any = {
      headers: { authorization: "Bearer valid-token" },
    };
    const context = createExecutionContext(request);

    supabaseAuthService.getUserByToken.mockResolvedValue({
      id: "user-1",
      email: "auth@example.com",
    } as any);

    userService.findByIdWithRoles.mockResolvedValue({
      id: "user-1",
      email: "profile@example.com",
      status: "active",
      roles: ["mentor"],
    } as any);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual(
      expect.objectContaining({
        id: "user-1",
        email: "profile@example.com",
        roles: ["mentor"],
      }),
    );
  });
});
