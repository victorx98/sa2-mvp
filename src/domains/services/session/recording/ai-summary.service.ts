import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { eq, and, isNull } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import axios, { AxiosInstance } from "axios";
import { SessionRecordingManager } from "./session-recording-manager";
import { SessionService } from "../services/session.service";
import { IAISummary, ISessionEntity } from "../interfaces/session.interface";
import { SessionNotFoundException } from "../exceptions/session.exception";

/**
 * AI Provider Type
 */
enum AIProvider {
  OPENAI = "openai",
  ANTHROPIC = "anthropic",
}

/**
 * AI Summary Service
 *
 * Generates AI-powered session summaries from transcripts
 * Supports OpenAI and Anthropic Claude APIs
 */
@Injectable()
export class AISummaryService {
  private readonly logger = new Logger(AISummaryService.name);
  private readonly httpClient: AxiosInstance;
  private readonly provider: AIProvider;
  private readonly apiKey: string;

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly recordingManager: SessionRecordingManager,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
  ) {
    this.httpClient = axios.create({
      timeout: 60000, // 60 seconds timeout for AI API
    });

    // Determine AI provider from config
    const providerConfig = this.configService.get<string>(
      "AI_PROVIDER",
      "openai",
    );
    this.provider =
      providerConfig === "anthropic" ? AIProvider.ANTHROPIC : AIProvider.OPENAI;

    // Get API key
    const apiKey =
      this.provider === AIProvider.OPENAI
        ? this.configService.get<string>("OPENAI_API_KEY")
        : this.configService.get<string>("ANTHROPIC_API_KEY");

    if (!apiKey) {
      this.logger.warn(
        `AI API key not configured for provider: ${this.provider}. AI summary generation will be disabled.`,
      );
      this.apiKey = "";
    } else {
      this.apiKey = apiKey;
      this.logger.log(
        `AI Summary Service initialized with provider: ${this.provider}`,
      );
    }
  }

  /**
   * Generate AI summary for a session
   *
   * @param sessionId - Session ID
   * @returns Generated AI summary
   */
  async generateSummary(sessionId: string): Promise<IAISummary> {
    this.logger.log(`Generating AI summary for session: ${sessionId}`);

    if (!this.apiKey) {
      throw new Error("AI API key not configured");
    }

    // Get session
    const session = await this.sessionService.getSessionById(sessionId);
    if (!session) {
      throw new SessionNotFoundException("SESSION_NOT_FOUND");
    }

    // Get all recordings
    const recordings = await this.recordingManager.getAllRecordings(sessionId);

    if (recordings.length === 0) {
      throw new Error("No recordings found for session");
    }

    // Check if all transcripts are available
    const allTranscriptsAvailable = recordings.every(
      (r) => r.transcriptUrl !== null,
    );

    if (!allTranscriptsAvailable) {
      throw new Error("Not all transcripts are available yet");
    }

    // Fetch transcripts from URLs
    const transcripts = await this.fetchTranscripts(recordings);

    // Combine transcripts
    const combinedTranscript = transcripts.join("\n\n---\n\n");

    // Generate summary using AI
    const summary = await this.callAIAPI(session, combinedTranscript);

    // Save summary to database
    await this.saveSummary(sessionId, summary);

    this.logger.log(`AI summary generated and saved for session: ${sessionId}`);

    return summary;
  }

  /**
   * Fetch transcripts from recording URLs
   *
   * @param recordings - Recording array
   * @returns Array of transcript texts
   */
  private async fetchTranscripts(
    recordings: Array<{ transcriptUrl: string | null }>,
  ): Promise<string[]> {
    const transcripts: string[] = [];

    for (const recording of recordings) {
      if (!recording.transcriptUrl) {
        continue;
      }

      try {
        const response = await this.httpClient.get(recording.transcriptUrl);
        const transcriptText =
          typeof response.data === "string"
            ? response.data
            : JSON.stringify(response.data);

        transcripts.push(transcriptText);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to fetch transcript from ${recording.transcriptUrl}: ${message}`,
        );
        // Continue with other transcripts
      }
    }

    if (transcripts.length === 0) {
      throw new Error("Failed to fetch any transcripts");
    }

    return transcripts;
  }

  /**
   * Call AI API to generate summary
   *
   * @param session - Session entity
   * @param transcript - Combined transcript text
   * @returns AI summary
   */
  private async callAIAPI(
    session: ISessionEntity,
    transcript: string,
  ): Promise<IAISummary> {
    const prompt = this.buildPrompt(session, transcript);

    if (this.provider === AIProvider.OPENAI) {
      return this.callOpenAI(prompt);
    } else {
      return this.callAnthropic(prompt);
    }
  }

  /**
   * Build prompt for AI
   *
   * @param session - Session entity
   * @param transcript - Transcript text
   * @returns Prompt string
   */
  private buildPrompt(session: ISessionEntity, transcript: string): string {
    const effectiveMinutes = session.effectiveTutoringDurationSeconds
      ? Math.floor(session.effectiveTutoringDurationSeconds / 60)
      : 0;

    return `You are an AI assistant helping to summarize a tutoring session.

Session Information:
- Session Name: ${session.sessionName}
- Scheduled Duration: ${session.scheduledDuration} minutes
- Actual Effective Duration: ${effectiveMinutes} minutes
- Notes: ${session.notes || "None"}

Transcript:
${transcript}

Please provide a comprehensive summary in the following JSON format:
{
  "summary": "A concise 2-3 paragraph summary of the main topics discussed",
  "topics": ["Array of key topics covered"],
  "key_points": ["Array of key learning points and insights"],
  "suggestions": ["Array of suggestions for the student's future learning"],
  "duration_analysis": {
    "effective_minutes": ${effectiveMinutes},
    "topic_breakdown": {
      "Topic 1": estimated_minutes,
      "Topic 2": estimated_minutes
    }
  }
}

Please respond ONLY with the JSON object, no additional text.`;
  }

  /**
   * Call OpenAI API
   *
   * @param prompt - Prompt text
   * @returns AI summary
   */
  private async callOpenAI(prompt: string): Promise<IAISummary> {
    try {
      const response = await this.httpClient.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: this.configService.get<string>("OPENAI_MODEL", "gpt-4o-mini"),
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that summarizes tutoring sessions. Always respond with valid JSON only.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
          response_format: { type: "json_object" },
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      const content = response.data.choices[0].message.content;
      const summary = JSON.parse(content) as IAISummary;

      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`OpenAI API error: ${message}`);
      throw new Error(`Failed to generate AI summary: ${message}`);
    }
  }

  /**
   * Call Anthropic Claude API
   *
   * @param prompt - Prompt text
   * @returns AI summary
   */
  private async callAnthropic(prompt: string): Promise<IAISummary> {
    try {
      const response = await this.httpClient.post(
        "https://api.anthropic.com/v1/messages",
        {
          model: this.configService.get<string>(
            "ANTHROPIC_MODEL",
            "claude-3-5-sonnet-20241022",
          ),
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          headers: {
            "x-api-key": this.apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
        },
      );

      const content = response.data.content[0].text;
      const summary = JSON.parse(content) as IAISummary;

      return summary;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Anthropic API error: ${message}`);
      throw new Error(`Failed to generate AI summary: ${message}`);
    }
  }

  /**
   * Save AI summary to database
   *
   * @param sessionId - Session ID
   * @param summary - AI summary
   */
  private async saveSummary(
    sessionId: string,
    summary: IAISummary,
  ): Promise<void> {
    await this.db
      .update(schema.sessions)
      .set({
        aiSummary: summary as never,
      })
      .where(
        and(
          eq(schema.sessions.id, sessionId),
          isNull(schema.sessions.deletedAt),
        ),
      );

    this.logger.debug(`AI summary saved to database for session: ${sessionId}`);
  }

  /**
   * Check if session has AI summary
   *
   * @param sessionId - Session ID
   * @returns True if summary exists, false otherwise
   */
  async hasSummary(sessionId: string): Promise<boolean> {
    const session = await this.sessionService.getSessionById(sessionId);
    if (!session) {
      throw new SessionNotFoundException("SESSION_NOT_FOUND");
    }

    return session.aiSummary !== null && session.aiSummary !== undefined;
  }

  /**
   * Regenerate AI summary (useful if transcript was updated)
   *
   * @param sessionId - Session ID
   * @returns Generated AI summary
   */
  async regenerateSummary(sessionId: string): Promise<IAISummary> {
    this.logger.log(`Regenerating AI summary for session: ${sessionId}`);
    return this.generateSummary(sessionId);
  }
}
