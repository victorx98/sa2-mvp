import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import {
  ICalendarService,
  ICreateCalendarEventDto,
  IUpdateCalendarEventDto,
  IAttendeeDto,
} from '@core/notification/interfaces';

/**
 * Feishu Calendar Service
 * 
 * Manages Feishu calendar events via Feishu Open API
 * Supports create, update, cancel operations
 * 
 * API Reference: https://open.feishu.cn/document/server-docs/calendar-v4/calendar-event
 */
@Injectable()
export class FeishuCalendarService implements ICalendarService {
  private readonly logger = new Logger(FeishuCalendarService.name);
  private readonly httpClient: AxiosInstance;
  private readonly calendarId: string;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor(private readonly configService: ConfigService) {
    // Configure HTTP proxy if available (for environments behind proxy)
    const httpsProxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    const httpsAgent = httpsProxy ? new HttpsProxyAgent(httpsProxy) : undefined;

    this.httpClient = axios.create({
      baseURL: 'https://open.feishu.cn/open-apis',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
      httpsAgent,
      proxy: false, // Disable axios built-in proxy, use httpsAgent instead
    });

    if (httpsProxy) {
      this.logger.log(`Feishu Calendar API configured with HTTPS proxy: ${httpsProxy}`);
    }

    // Get calendar ID from config
    // Note: Feishu requires actual calendar_id, not 'primary'
    // You need to get calendar_id from Feishu admin console or API
    this.calendarId = this.configService.get<string>('FEISHU_CALENDAR_ID') || '';
    
    if (!this.calendarId) {
      this.logger.warn('FEISHU_CALENDAR_ID not configured. Calendar features will not work.');
    }
  }

  /**
   * Create calendar event
   * 
   * Steps:
   * 1. Create event via POST /calendar/v4/calendars/:calendar_id/events
   * 2. Add attendees via POST /calendar/v4/calendars/:calendar_id/events/:event_id/attendees
   * 
   * @param dto - Create calendar event DTO
   * @returns Event ID
   */
  async createEvent(dto: ICreateCalendarEventDto): Promise<string> {
    try {
      await this.ensureAccessToken();

      // Step 1: Create event
      const createResponse = await this.httpClient.post(
        `/calendar/v4/calendars/${this.calendarId}/events`,
        {
          summary: dto.summary,
          description: dto.description || '',
          start_time: {
            timestamp: Math.floor(dto.startTime.getTime() / 1000).toString(),
          },
          end_time: {
            timestamp: Math.floor(dto.endTime.getTime() / 1000).toString(),
          },
          vchat: dto.meetingUrl
            ? {
                vc_type: 'third_party',
                meeting_url: dto.meetingUrl,
              }
            : undefined,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (createResponse.data.code !== 0) {
        throw new Error(
          `Failed to create Feishu calendar event: ${createResponse.data.msg}`,
        );
      }

      const eventId = createResponse.data.data.event.event_id;
      this.logger.log(`Created Feishu calendar event: ${eventId}`);

      // Step 2: Add attendees (supports external emails)
      if (dto.attendees && dto.attendees.length > 0) {
        await this.addAttendees(eventId, dto.attendees);
      }

      return eventId;
    } catch (error) {
      // Log detailed error for debugging
      const errorDetails = error instanceof Error ? {
        message: error.message,
        response: (error as any).response?.data,
        status: (error as any).response?.status,
      } : error;
      
      this.logger.error(
        `Failed to create Feishu calendar event: ${JSON.stringify(errorDetails)}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }

  /**
   * Add attendees to calendar event
   * Supports external email addresses
   * 
   * @param eventId - Event ID
   * @param attendees - Array of attendees
   */
  async addAttendees(eventId: string, attendees: IAttendeeDto[]): Promise<void> {
    try {
      await this.ensureAccessToken();

      const attendeeList = attendees.map((attendee) => ({
        type: 'third_party',
        third_party_email: attendee.email,
        display_name: attendee.displayName || attendee.email,
        is_optional: attendee.isOptional || false,
      }));

      const response = await this.httpClient.post(
        `/calendar/v4/calendars/${this.calendarId}/events/${eventId}/attendees`,
        {
          attendees: attendeeList,
        },
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.code !== 0) {
        throw new Error(
          `Failed to add attendees to Feishu calendar event: ${response.data.msg}`,
        );
      }

      this.logger.log(`Added ${attendees.length} attendees to Feishu event ${eventId}`);
    } catch (error) {
      this.logger.error(
        `Failed to add attendees to Feishu event ${eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }

  /**
   * Update calendar event
   * 
   * @param eventId - Event ID
   * @param updates - Update fields
   */
  async updateEvent(eventId: string, updates: IUpdateCalendarEventDto): Promise<void> {
    try {
      await this.ensureAccessToken();

      const updateData: any = {};

      if (updates.summary) {
        updateData.summary = updates.summary;
      }

      if (updates.description !== undefined) {
        updateData.description = updates.description;
      }

      if (updates.startTime && updates.endTime) {
        updateData.start_time = {
          timestamp: Math.floor(updates.startTime.getTime() / 1000).toString(),
        };
        updateData.end_time = {
          timestamp: Math.floor(updates.endTime.getTime() / 1000).toString(),
        };
      }

      if (updates.meetingUrl) {
        updateData.vchat = {
          vc_type: 'third_party',
          meeting_url: updates.meetingUrl,
        };
      }

      const response = await this.httpClient.patch(
        `/calendar/v4/calendars/${this.calendarId}/events/${eventId}`,
        updateData,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.data.code !== 0) {
        throw new Error(
          `Failed to update Feishu calendar event: ${response.data.msg}`,
        );
      }

      this.logger.log(`Updated Feishu calendar event: ${eventId}`);
    } catch (error) {
      this.logger.error(
        `Failed to update Feishu calendar event ${eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }

  /**
   * Cancel calendar event
   * 
   * @param eventId - Event ID
   */
  async cancelEvent(eventId: string): Promise<void> {
    try {
      await this.ensureAccessToken();

      const response = await this.httpClient.delete(
        `/calendar/v4/calendars/${this.calendarId}/events/${eventId}`,
        {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        },
      );

      if (response.data.code !== 0) {
        throw new Error(
          `Failed to cancel Feishu calendar event: ${response.data.msg}`,
        );
      }

      this.logger.log(`Cancelled Feishu calendar event: ${eventId}`);
    } catch (error) {
      this.logger.error(
        `Failed to cancel Feishu calendar event ${eventId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }

  /**
   * Ensure access token is valid
   * Fetches new token if expired or not present
   */
  private async ensureAccessToken(): Promise<void> {
    const now = Date.now();

    // Check if token is still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiry > now + 5 * 60 * 1000) {
      return;
    }

    // Fetch new access token
    try {
      const appId = this.configService.get<string>('FEISHU_APP_ID');
      const appSecret = this.configService.get<string>('FEISHU_APP_SECRET');

      if (!appId || !appSecret) {
        throw new Error('Feishu app credentials not configured');
      }

      const response = await this.httpClient.post('/auth/v3/tenant_access_token/internal', {
        app_id: appId,
        app_secret: appSecret,
      });

      // Check response format (Feishu returns code=0 for success)
      if (response.data.code !== 0 && response.data.code !== undefined) {
        throw new Error(`Failed to get Feishu access token: ${response.data.msg || JSON.stringify(response.data)}`);
      }

      // Handle both response formats
      this.accessToken = response.data.tenant_access_token || response.data.access_token;
      this.tokenExpiry = now + (response.data.expire || 7200) * 1000;
      
      if (!this.accessToken) {
        throw new Error(`Invalid Feishu token response: ${JSON.stringify(response.data)}`);
      }

      this.logger.debug('Fetched new Feishu access token');
    } catch (error) {
      // Log detailed error information for debugging
      const errorDetails = error instanceof Error ? {
        message: error.message,
        response: (error as any).response?.data,
        status: (error as any).response?.status,
      } : error;
      
      this.logger.error(
        `Failed to fetch Feishu access token: ${JSON.stringify(errorDetails)}`,
        error instanceof Error ? error.stack : '',
      );
      throw error;
    }
  }
}

