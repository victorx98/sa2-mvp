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
  private http: AxiosInstance;
  private readonly serviceHeaders: Record<string, string>;
  private proxyDisabled = false;
  private readonly supabaseUrl: string;
  private readonly authTimeout: number;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl =
      this.configService.get<string>("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
    const serviceRoleKey =
      this.configService.get<string>("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const anonKey =
      this.configService.get<string>("SUPABASE_ANON_KEY") ?? serviceRoleKey;

    if (!this.supabaseUrl) {
      throw new Error("SUPABASE_URL is not configured");
    }
    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }
    if (!anonKey) {
      throw new Error("SUPABASE_ANON_KEY is not configured");
    }

    this.authTimeout = this.configService.get<number>("SUPABASE_AUTH_TIMEOUT") ?? 30000;

    this.http = this.createAxiosInstance();

    this.serviceHeaders = {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
    };

    this.publicHeaders = {
      apikey: anonKey,
    };
  }

  private readonly publicHeaders: Record<string, string>;

  private createAxiosInstance(): AxiosInstance {
    const httpsProxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const node_env = process.env.NODE_ENV;
    
    const axiosConfig: Parameters<typeof axios.create>[0] = {
      baseURL: `${this.supabaseUrl}/auth/v1`,
      timeout: this.authTimeout,
      proxy: false,
    };

    if (!this.proxyDisabled && httpsProxyUrl && node_env === "development") {
      try {
        const normalizedProxyUrl = this.normalizeProxyUrl(httpsProxyUrl);
        this.logger.log(`Using HTTPS proxy for Supabase: ${normalizedProxyUrl}`);
        axiosConfig.httpsAgent = new HttpsProxyAgent(normalizedProxyUrl);
      } catch (error) {
        this.logger.warn(
          `Failed to configure HTTPS proxy (${httpsProxyUrl}): ${error instanceof Error ? error.message : String(error)}. ` +
          `Continuing without proxy.`
        );
        this.proxyDisabled = true;
      }
    } else if (httpsProxyUrl && node_env !== "development") {
      this.logger.warn(
        `HTTPS_PROXY/HTTP_PROXY is set but NODE_ENV is not 'development'. ` +
        `Proxy will not be used. Current NODE_ENV: ${node_env}`
      );
    } else if (this.proxyDisabled) {
      this.logger.debug('Proxy disabled due to previous connection failure. Using direct connection.');
    } else {
      this.logger.debug('No HTTPS proxy configured. Direct connection will be used.');
    }

    return axios.create(axiosConfig);
  }

  private disableProxyAndRecreate(): void {
    if (this.proxyDisabled) {
      return;
    }
    
    this.proxyDisabled = true;
    this.logger.warn(
      'Proxy connection failed. Disabling proxy and recreating HTTP client for direct connection. ' +
      'If proxy is required, ensure proxy server is running and accessible.'
    );
    this.http = this.createAxiosInstance();
  }

  private normalizeProxyUrl(url: string): string {
    if (!url || url.trim().length === 0) {
      return url;
    }
    
    const trimmedUrl = url.trim();
    
    if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
      return trimmedUrl;
    }
    
    return `http://${trimmedUrl}`;
  }

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
      if (axios.isAxiosError(error) && error.code === "ECONNREFUSED" && !this.proxyDisabled) {
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        if (proxyUrl && process.env.NODE_ENV === "development") {
          this.disableProxyAndRecreate();
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
          } catch (retryError) {
            throw this.handleAxiosError(
              retryError,
              "Failed to create Supabase Auth user",
            );
          }
        }
      }
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
      if (axios.isAxiosError(error) && error.code === "ECONNREFUSED" && !this.proxyDisabled) {
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        if (proxyUrl && process.env.NODE_ENV === "development") {
          this.disableProxyAndRecreate();
          try {
            await this.http.delete(`/admin/users/${userId}`, {
              headers: this.serviceHeaders,
            });
            return;
          } catch (retryError) {
            throw this.handleAxiosError(
              retryError,
              `Failed to delete Supabase Auth user ${userId}`,
            );
          }
        }
      }
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
      if (axios.isAxiosError(error) && error.code === "ECONNREFUSED" && !this.proxyDisabled) {
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        if (proxyUrl && process.env.NODE_ENV === "development") {
          this.disableProxyAndRecreate();
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
          } catch (retryError) {
            throw this.handleAxiosError(retryError, "Failed to sign in with Supabase Auth");
          }
        }
      }
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
      if (axios.isAxiosError(error) && error.code === "ECONNREFUSED" && !this.proxyDisabled) {
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        if (proxyUrl && process.env.NODE_ENV === "development") {
          this.disableProxyAndRecreate();
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
          } catch (retryError) {
            throw this.handleAxiosError(
              retryError,
              "Failed to retrieve Supabase user by token",
            );
          }
        }
      }
      throw this.handleAxiosError(
        error,
        "Failed to retrieve Supabase user by token",
      );
    }
  }

  private handleAxiosError(error: unknown, message: string): SupabaseAuthException {
    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<{ error?: string; msg?: string; error_description?: string }>;
      const status = axiosError.response?.status;
      const errorMessage =
        axiosError.response?.data?.error ||
        axiosError.response?.data?.error_description ||
        axiosError.response?.data?.msg ||
        axiosError.message;

      if (axiosError.code === "ECONNABORTED") {
        this.logger.warn(
          `${message}: Request timeout (${this.http.defaults.timeout}ms). ` +
          `This may indicate network latency issues. ` +
          `Consider adjusting SUPABASE_AUTH_TIMEOUT environment variable.`,
        );
      } else if (axiosError.code === "ECONNREFUSED") {
        const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
        const proxyHint = proxyUrl
          ? ` Connection refused to proxy: ${proxyUrl}. ` +
            `If proxy is not needed, remove HTTP_PROXY/HTTPS_PROXY environment variables. ` +
            `If proxy is required, ensure proxy server is running and accessible.`
          : ` Connection refused. Check network connectivity and Supabase URL configuration.`;
        
        this.logger.error(
          `${message}: Connection refused (${axiosError.message}).${proxyHint} ` +
          `Request URL: ${axiosError.config?.url || 'unknown'}`,
          axiosError.stack,
        );
      } else {
        this.logger.error(
          `${message}: Status=${status}, Message=${errorMessage}, Code=${axiosError.code}. ` +
          `Response Data: ${JSON.stringify(axiosError.response?.data)}. ` +
          `Request URL: ${axiosError.config?.url || 'unknown'}`,
          axiosError.stack,
        );
      }

      return new SupabaseAuthException(message, status, axiosError.response?.data);
    }

    if (error instanceof SupabaseAuthException) {
      return error;
    }

    this.logger.error(message, (error as Error)?.stack);
    return new SupabaseAuthException(message);
  }
}
