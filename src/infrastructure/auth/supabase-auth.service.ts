import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosError, AxiosInstance } from "axios";

export interface SupabaseAuthUser {
  id: string;
  email?: string;
  [key: string]: unknown;
}

export interface SupabaseSignInResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: SupabaseAuthUser;
}

export class SupabaseAuthException extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

interface CreateAuthUserInput {
  email: string;
  password: string;
  emailConfirmed?: boolean;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private readonly http: AxiosInstance;
  private readonly serviceHeaders: Record<string, string>;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
    const serviceRoleKey =
      this.configService.get<string>("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey =
      this.configService.get<string>("SUPABASE_ANON_KEY") ?? serviceRoleKey;

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL is not configured");
    }
    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }
    if (!anonKey) {
      throw new Error("SUPABASE_ANON_KEY is not configured");
    }

    this.http = axios.create({
      baseURL: `${supabaseUrl}/auth/v1`,
      timeout: 10000,
    });

    this.serviceHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };

    this.publicHeaders = {
      apikey: anonKey,
    };
  }

  private readonly publicHeaders: Record<string, string>;

  /**
   * Create Supabase Auth user via Admin API
   */
  async createUser(input: CreateAuthUserInput): Promise<SupabaseAuthUser> {
    try {
      const { data } = await this.http.post(
        "/admin/users",
        {
          email: input.email,
          password: input.password,
          email_confirm: input.emailConfirmed ?? true,
          user_metadata: input.metadata ?? {},
        },
        { headers: this.serviceHeaders },
      );

      const user: SupabaseAuthUser = data?.user ?? data;
      if (!user?.id) {
        throw new SupabaseAuthException("Supabase user ID is missing");
      }
      return user;
    } catch (error) {
      throw this.handleAxiosError(
        error,
        "Failed to create Supabase Auth user",
      );
    }
  }

  /**
   * Delete Supabase Auth user (compensation step)
   */
  async deleteUser(userId: string): Promise<void> {
    try {
      await this.http.delete(`/admin/users/${userId}`, {
        headers: this.serviceHeaders,
      });
    } catch (error) {
      throw this.handleAxiosError(
        error,
        `Failed to delete Supabase Auth user ${userId}`,
      );
    }
  }

  /**
   * Sign in using Supabase Auth password grant flow
   */
  async signInWithPassword(input: {
    email: string;
    password: string;
  }): Promise<SupabaseSignInResult> {
    try {
      const { data } = await this.http.post(
        "/token?grant_type=password",
        {
          email: input.email,
          password: input.password,
        },
        {
          headers: {
            ...this.publicHeaders,
            "Content-Type": "application/json",
          },
        },
      );

      if (!data?.access_token || !data?.user?.id) {
        throw new SupabaseAuthException("Invalid sign-in response from Supabase");
      }

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        user: data.user,
      };
    } catch (error) {
      throw this.handleAxiosError(error, "Failed to sign in with Supabase Auth");
    }
  }

  /**
   * Verify access token and retrieve Supabase user
   */
  async getUserByToken(token: string): Promise<SupabaseAuthUser> {
    try {
      const { data } = await this.http.get("/user", {
        headers: {
          ...this.publicHeaders,
          Authorization: `Bearer ${token}`,
        },
      });

      if (!data?.id) {
        throw new SupabaseAuthException("Supabase user not found");
      }

      return data;
    } catch (error) {
      throw this.handleAxiosError(
        error,
        "Failed to retrieve Supabase user by token",
      );
    }
  }

  private handleAxiosError(error: unknown, message: string): SupabaseAuthException {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; msg?: string }>;
      const status = axiosError.response?.status;
      const errorMessage =
        axiosError.response?.data?.error ||
        axiosError.response?.data?.msg ||
        axiosError.message;

      this.logger.error(`${message}: ${errorMessage}`, axiosError.stack);
      return new SupabaseAuthException(message, status, axiosError.response?.data);
    }

    if (error instanceof SupabaseAuthException) {
      return error;
    }

    this.logger.error(message, (error as Error)?.stack);
    return new SupabaseAuthException(message);
  }
}
