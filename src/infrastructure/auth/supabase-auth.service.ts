import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosError, AxiosInstance } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

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

export enum SupabaseAuthErrorCode {
  TOKEN_EXPIRED = "TOKEN_EXPIRED", // Token has expired [Token已过期]
  TOKEN_INVALID = "TOKEN_INVALID", // Token is invalid [Token无效]
  NETWORK_ERROR = "NETWORK_ERROR", // Network/connection error [网络错误]
  UNKNOWN_ERROR = "UNKNOWN_ERROR", // Unknown error [未知错误]
}

export class SupabaseAuthException extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly details?: unknown,
    public readonly errorCode: SupabaseAuthErrorCode = SupabaseAuthErrorCode.UNKNOWN_ERROR,
  ) {
    super(message);
    this.name = "SupabaseAuthException";
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

    const authTimeout = this.configService.get<number>("SUPABASE_AUTH_TIMEOUT") ?? 30000;

    // check proxy environment variables and configure HTTPS proxy agent
    const httpsProxyUrl = process.env.HTTP_PROXY;
    const node_env = process.env.NODE_ENV;
    
    const axiosConfig: Parameters<typeof axios.create>[0] = {
      baseURL: `${supabaseUrl}/auth/v1`,
      timeout: authTimeout,
      proxy: false, // disable axios built-in proxy handling (will cause HTTP to be sent to HTTPS ports)
    };

    // if proxy environment variables exist, use https-proxy-agent to correctly handle HTTPS requests
    // Always use proxy agent if available (removes NODE_ENV restriction)
    // This helps with DNS resolution in restricted network environments (e.g., WSL2)
    if (httpsProxyUrl && node_env === "development") {
      this.logger.log(`Using HTTPS proxy for Supabase: ${httpsProxyUrl}`);
      axiosConfig.httpsAgent = new HttpsProxyAgent(httpsProxyUrl);
    } else {
      // Even without proxy URL, we need to set httpsAgent to handle DNS properly in WSL2
      this.logger.warn('No HTTPS proxy configured. If Supabase connection fails, consider setting HTTPS_PROXY environment variable.');
    }

    this.http = axios.create(axiosConfig);

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
      const startTime = Date.now();
      const { data } = await this.http.get("/user", {
        headers: {
          ...this.publicHeaders,
          Authorization: `Bearer ${token}`,
        },
      });

      const duration = Date.now() - startTime;
      this.logger.debug(`Supabase user verification completed in ${duration}ms`);

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
      const axiosError = error as AxiosError<{
        error?: string;
        msg?: string;
        error_description?: string;
        error_code?: string;
        code?: number;
      }>;
      const status = axiosError.response?.status;
      const responseData = axiosError.response?.data;
      const errorMessage =
        responseData?.error ||
        responseData?.error_description ||
        responseData?.msg ||
        axiosError.message;
      const errorCode = responseData?.error_code;

      // Identify token expiration error [识别token过期错误]
      const isTokenExpired =
        status === 403 &&
        (errorCode === "bad_jwt" ||
          (typeof responseData?.msg === "string" &&
            responseData.msg.toLowerCase().includes("expired")) ||
          (typeof errorMessage === "string" &&
            errorMessage.toLowerCase().includes("expired")));

      // Identify invalid token error [识别无效token错误]
      const isTokenInvalid =
        status === 401 ||
        (status === 403 &&
          errorCode === "bad_jwt" &&
          !isTokenExpired);

      // Determine error code [确定错误码]
      let authErrorCode: SupabaseAuthErrorCode;
      if (isTokenExpired) {
        authErrorCode = SupabaseAuthErrorCode.TOKEN_EXPIRED;
      } else if (isTokenInvalid) {
        authErrorCode = SupabaseAuthErrorCode.TOKEN_INVALID;
      } else if (axiosError.code === "ECONNABORTED" || !status) {
        authErrorCode = SupabaseAuthErrorCode.NETWORK_ERROR;
      } else {
        authErrorCode = SupabaseAuthErrorCode.UNKNOWN_ERROR;
      }

      // Log error with appropriate level [根据错误类型记录日志]
      if (axiosError.code === "ECONNABORTED") {
        this.logger.warn(
          `${message}: Request timeout (${this.http.defaults.timeout}ms). ` +
            `This may indicate network latency issues. ` +
            `Consider adjusting SUPABASE_AUTH_TIMEOUT environment variable.`,
        );
      } else if (isTokenExpired) {
        // Token expiration is expected behavior, log at debug level [Token过期是预期行为，使用debug级别日志]
        this.logger.debug(
          `${message}: Token expired. Status=${status}, ErrorCode=${errorCode}, Message=${errorMessage}`,
        );
      } else {
        // Other errors log at error level [其他错误使用error级别日志]
        this.logger.error(
          `${message}: Status=${status}, ErrorCode=${errorCode}, Message=${errorMessage}. ` +
            `Response Data: ${JSON.stringify(responseData)}`,
          axiosError.stack,
        );
      }

      return new SupabaseAuthException(
        message,
        status,
        responseData,
        authErrorCode,
      );
    }

    if (error instanceof SupabaseAuthException) {
      return error;
    }

    this.logger.error(message, (error as Error)?.stack);
    return new SupabaseAuthException(
      message,
      undefined,
      undefined,
      SupabaseAuthErrorCode.UNKNOWN_ERROR,
    );
  }
}
