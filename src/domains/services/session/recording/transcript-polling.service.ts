import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import axios, { AxiosInstance } from "axios";
import { SessionRecordingManager } from "./session-recording-manager";
import { SessionService } from "../services/session.service";

/**
 * Transcript Polling Configuration
 */
interface IPollingConfig {
  intervalMinutes: number; // Polling interval in minutes
  maxAttempts: number; // Maximum number of polling attempts
}

/**
 * Polling Job
 */
interface IPollingJob {
  sessionId: string;
  recordingId: string;
  meetingId: string;
  provider: string;
  attempts: number;
  nextPollTime: Date;
  config: IPollingConfig;
}

/**
 * Transcript Polling Service
 *
 * Polls meeting platforms (Feishu/Zoom) to fetch transcript URLs
 * Uses in-memory job queue with configurable polling intervals
 */
@Injectable()
export class TranscriptPollingService {
  private readonly logger = new Logger(TranscriptPollingService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl = "https://open.feishu.cn/open-apis";

  // In-memory polling job queue
  private pollingJobs: Map<string, IPollingJob> = new Map();

  // Polling interval timer
  private pollingTimer: NodeJS.Timeout | null = null;

  // Tenant access token cache
  private tenantAccessToken: string | null = null;
  private tokenExpireTime = 0;

  constructor(
    private readonly recordingManager: SessionRecordingManager,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
    });

    // Start polling timer (check every minute)
    this.startPollingTimer();
  }

  /**
   * Start polling for a recording's transcript
   *
   * @param sessionId - Session ID
   * @param recordingId - Recording ID
   * @param meetingId - Meeting ID (from meeting provider)
   * @param provider - Meeting provider (feishu | zoom)
   * @param config - Polling configuration
   */
  async startPolling(
    sessionId: string,
    recordingId: string,
    meetingId: string,
    provider: string,
    config?: Partial<IPollingConfig>,
  ): Promise<void> {
    const defaultConfig: IPollingConfig = {
      intervalMinutes: 5, // Poll every 5 minutes
      maxAttempts: 100, // Max 100 attempts (up to ~8 hours)
    };

    const finalConfig: IPollingConfig = {
      ...defaultConfig,
      ...config,
    };

    const jobKey = `${sessionId}:${recordingId}`;

    // Check if job already exists
    if (this.pollingJobs.has(jobKey)) {
      this.logger.warn(`Polling job already exists for: ${jobKey}`);
      return;
    }

    // Create polling job
    const job: IPollingJob = {
      sessionId,
      recordingId,
      meetingId,
      provider,
      attempts: 0,
      nextPollTime: new Date(), // Poll immediately
      config: finalConfig,
    };

    this.pollingJobs.set(jobKey, job);

    this.logger.log(
      `Started transcript polling for recording: ${recordingId}, session: ${sessionId}`,
    );
  }

  /**
   * Start polling timer (runs every minute)
   */
  private startPollingTimer(): void {
    if (this.pollingTimer) {
      return;
    }

    this.pollingTimer = setInterval(
      () => {
        this.processPollingJobs();
      },
      60 * 1000,
    ); // Check every minute

    this.logger.log("Transcript polling timer started");
  }

  /**
   * Process all polling jobs
   */
  private async processPollingJobs(): Promise<void> {
    const now = new Date();

    for (const [jobKey, job] of this.pollingJobs.entries()) {
      // Check if it's time to poll
      if (job.nextPollTime > now) {
        continue;
      }

      // Check if max attempts reached
      if (job.attempts >= job.config.maxAttempts) {
        this.logger.warn(
          `Max attempts reached for polling job: ${jobKey}, removing`,
        );
        this.pollingJobs.delete(jobKey);
        continue;
      }

      // Attempt to fetch transcript
      await this.attemptFetchTranscript(jobKey, job);
    }
  }

  /**
   * Attempt to fetch transcript URL
   *
   * @param jobKey - Job key
   * @param job - Polling job
   */
  private async attemptFetchTranscript(
    jobKey: string,
    job: IPollingJob,
  ): Promise<void> {
    this.logger.debug(
      `Attempting to fetch transcript for job: ${jobKey}, attempt: ${job.attempts + 1}/${job.config.maxAttempts}`,
    );

    try {
      let transcriptUrl: string | null = null;

      // Fetch based on provider
      if (job.provider === "feishu") {
        transcriptUrl = await this.fetchFeishuTranscript(
          job.meetingId,
          job.recordingId,
        );
      } else if (job.provider === "zoom") {
        transcriptUrl = await this.fetchZoomTranscript(
          job.meetingId,
          job.recordingId,
        );
      }

      if (transcriptUrl) {
        // Transcript found, update recording
        await this.recordingManager.updateRecordingTranscript(
          job.sessionId,
          job.recordingId,
          transcriptUrl,
        );

        this.logger.log(
          `Transcript URL fetched successfully for recording: ${job.recordingId}`,
        );

        // Remove job from queue
        this.pollingJobs.delete(jobKey);

        // Check if all transcripts are fetched
        await this.checkAllTranscriptsFetched(job.sessionId);
      } else {
        // Transcript not ready yet, schedule next poll
        job.attempts++;
        job.nextPollTime = new Date(
          Date.now() + job.config.intervalMinutes * 60 * 1000,
        );

        this.logger.debug(
          `Transcript not ready yet for recording: ${job.recordingId}, will retry in ${job.config.intervalMinutes} minutes`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Error fetching transcript for job: ${jobKey}: ${message}`,
      );

      // Schedule retry
      job.attempts++;
      job.nextPollTime = new Date(
        Date.now() + job.config.intervalMinutes * 60 * 1000,
      );
    }
  }

  /**
   * Fetch Feishu transcript URL
   *
   * @param meetingId - Feishu meeting ID
   * @param recordingId - Recording ID
   * @returns Transcript URL or null if not ready
   */
  private async fetchFeishuTranscript(
    meetingId: string,
    recordingId: string,
  ): Promise<string | null> {
    try {
      const token = await this.getTenantAccessToken();

      // Call Feishu API to get recording details
      const response = await this.httpClient.get(
        `/vc/v1/recordings/${recordingId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.data.code !== 0) {
        this.logger.debug(
          `Feishu API error: ${response.data.msg}, recording may not be ready`,
        );
        return null;
      }

      // Extract transcript URL from response
      const transcriptUrl = response.data.data?.recording?.transcript_url;

      return transcriptUrl || null;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.debug(
        `Failed to fetch Feishu transcript: ${message}, recording may not be ready`,
      );
      return null;
    }
  }

  /**
   * Fetch Zoom transcript URL
   *
   * @param meetingId - Zoom meeting ID
   * @param recordingId - Recording ID
   * @returns Transcript URL or null if not ready
   */
  private async fetchZoomTranscript(
    meetingId: string,
    recordingId: string,
  ): Promise<string | null> {
    // TODO: Implement Zoom transcript fetching
    // This requires Zoom API integration
    this.logger.warn("Zoom transcript fetching not yet implemented");
    return null;
  }

  /**
   * Check if all transcripts are fetched for a session
   * If yes, trigger AI summary generation
   *
   * @param sessionId - Session ID
   */
  private async checkAllTranscriptsFetched(sessionId: string): Promise<void> {
    const allFetched =
      await this.recordingManager.isAllTranscriptsFetched(sessionId);

    if (allFetched) {
      this.logger.log(
        `All transcripts fetched for session: ${sessionId}, triggering AI summary generation`,
      );

      // TODO: Trigger AI summary generation
      // This will be implemented in AISummaryService
      // await this.aiSummaryService.generateSummary(sessionId);
    }
  }

  /**
   * Get tenant access token with caching
   *
   * @returns Tenant access token
   */
  private async getTenantAccessToken(): Promise<string> {
    const now = Date.now();

    // Return cached token if valid
    if (this.tenantAccessToken && this.tokenExpireTime > now) {
      return this.tenantAccessToken;
    }

    this.logger.debug("Fetching new tenant access token for polling");

    const appId = this.configService.get<string>("FEISHU_APP_ID");
    const appSecret = this.configService.get<string>("FEISHU_APP_SECRET");

    if (!appId || !appSecret) {
      throw new Error("Feishu credentials not configured");
    }

    try {
      const response = await this.httpClient.post(
        "/auth/v3/tenant_access_token/internal",
        {
          app_id: appId,
          app_secret: appSecret,
        },
      );

      if (response.data.code !== 0) {
        throw new Error(`Failed to get token: ${response.data.msg}`);
      }

      const { tenant_access_token, expire } = response.data;

      // Cache token with 5 minute buffer before expiration
      this.tenantAccessToken = tenant_access_token;
      this.tokenExpireTime = now + (expire - 300) * 1000;

      return tenant_access_token;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get tenant access token: ${message}`);
      throw error;
    }
  }

  /**
   * Get polling job statistics
   *
   * @returns Job statistics
   */
  getStatistics(): {
    activeJobs: number;
    jobs: Array<{
      sessionId: string;
      recordingId: string;
      attempts: number;
      maxAttempts: number;
      nextPollTime: string;
    }>;
  } {
    const jobs = Array.from(this.pollingJobs.values()).map((job) => ({
      sessionId: job.sessionId,
      recordingId: job.recordingId,
      attempts: job.attempts,
      maxAttempts: job.config.maxAttempts,
      nextPollTime: job.nextPollTime.toISOString(),
    }));

    return {
      activeJobs: this.pollingJobs.size,
      jobs,
    };
  }

  /**
   * Cancel polling for a specific recording
   *
   * @param sessionId - Session ID
   * @param recordingId - Recording ID
   */
  cancelPolling(sessionId: string, recordingId: string): void {
    const jobKey = `${sessionId}:${recordingId}`;

    if (this.pollingJobs.has(jobKey)) {
      this.pollingJobs.delete(jobKey);
      this.logger.log(`Cancelled polling for recording: ${recordingId}`);
    }
  }

  /**
   * Cleanup on service destroy
   */
  onModuleDestroy(): void {
    if (this.pollingTimer) {
      clearInterval(this.pollingTimer);
      this.pollingTimer = null;
      this.logger.log("Transcript polling timer stopped");
    }
  }
}
