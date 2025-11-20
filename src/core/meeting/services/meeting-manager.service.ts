import { Injectable, Logger } from "@nestjs/common";
import { MeetingRepository } from "../repositories/meeting.repository";
import { MeetingProviderFactory } from "../providers/provider.factory";
import { CreateMeetingDto } from "../dto/create-meeting.dto";
import { UpdateMeetingDto } from "../dto/update-meeting.dto";
import { MeetingInfoDto } from "../dto/meeting-info.dto";
import { MeetingStatus } from "../entities/meeting.entity";
import {
  DuplicateMeetingException,
  InvalidMeetingStateException,
} from "../exceptions/meeting.exception";
import type { Meeting } from "@infrastructure/database/schema/meetings.schema";
import type { DrizzleTransaction } from "@shared/types/database.types";

/**
 * Meeting Manager Service
 *
 * Handles application-layer commands for meeting resource management
 * Responsibilities:
 * 1. Create meetings (with deduplication check)
 * 2. Update meetings (validate state)
 * 3. Cancel meetings
 */
@Injectable()
export class MeetingManagerService {
  private readonly logger = new Logger(MeetingManagerService.name);

  constructor(
    private readonly meetingRepo: MeetingRepository,
    private readonly providerFactory: MeetingProviderFactory,
  ) {}

  /**
   * Create a new meeting
   *
   * Flow:
   * 1. Call provider to create meeting on third-party platform (Feishu/Zoom)
   * 2. Deduplication check (7-day window)
   * 3. Store meeting in database (within transaction if provided)
   *
   * @param dto - Create meeting DTO
   * @param tx - Optional transaction context (for Application Layer orchestration)
   * @returns Meeting entity
   */
  async createMeeting(dto: CreateMeetingDto, tx?: DrizzleTransaction): Promise<Meeting> {
    this.logger.debug(`Creating meeting: ${dto.topic}`);

    const startTime = new Date(dto.startTime);
    const provider =
      dto.provider || this.providerFactory.getDefaultProviderType();

    // Step 1: Deduplication check
    // We check if a meeting with same meeting_no exists within 7-day window
    // Note: meeting_no is only known after creation, so this is done after provider call

    // Step 2: Call provider to create meeting
    const providerInstance = this.providerFactory.getProvider(provider);

    const meetingInfo = await providerInstance.createMeeting({
      topic: dto.topic,
      startTime,
      duration: dto.duration,
      hostUserId: dto.hostUserId,
      autoRecord: dto.autoRecord,
      enableWaitingRoom: dto.enableWaitingRoom,
      participantJoinEarly: dto.participantJoinEarly,
    });

    this.logger.debug(
      `Meeting created on ${provider}: ${meetingInfo.meetingId}`,
    );

    // Step 2.5: Now check for duplicates using meeting_no
    if (meetingInfo.meetingNo) {
      const isDuplicate = await this.meetingRepo.existsWithinTimeWindow(
        meetingInfo.meetingNo,
        startTime,
        provider,
      );

      if (isDuplicate) {
        // Attempt to cancel the just-created meeting
        try {
          await providerInstance.cancelMeeting(meetingInfo.meetingId);
          this.logger.warn(
            `Cancelled duplicate meeting ${meetingInfo.meetingNo}`,
          );
        } catch (error) {
          this.logger.error(
            `Failed to cancel duplicate meeting: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        throw new DuplicateMeetingException(
          meetingInfo.meetingNo,
          "within 7 days",
        );
      }
    }

    // Step 3: Store in database (use transaction if provided)
    const meeting = await this.meetingRepo.create({
      meetingNo: meetingInfo.meetingNo || "",
      meetingProvider: provider,
      meetingId: meetingInfo.meetingId,
      topic: dto.topic,
      meetingUrl: meetingInfo.meetingUrl,
      scheduleStartTime: startTime,
      scheduleDuration: dto.duration,
      status: MeetingStatus.SCHEDULED,
      actualDuration: null,
      meetingTimeList: [],
      recordingUrl: null,
      lastMeetingEndedTimestamp: null,
      pendingTaskId: null,
      eventType: null,
    }, tx); // Pass transaction context if provided

    this.logger.log(
      `Meeting created successfully: ${meeting.id} (${meeting.meetingNo})`,
    );

    return meeting;
  }

  /**
   * Update an existing meeting
   *
   * Validation:
   * - Only scheduled meetings can be updated
   * - Active/ended meetings cannot be modified
   *
   * @param meetingId - Meeting UUID
   * @param dto - Update meeting DTO
   * @returns Updated meeting entity
   */
  async updateMeeting(
    meetingId: string,
    dto: UpdateMeetingDto,
  ): Promise<Meeting> {
    this.logger.debug(`Updating meeting: ${meetingId}`);

    // Fetch current meeting
    const meeting = await this.meetingRepo.findById(meetingId);

    if (!meeting) {
      throw new InvalidMeetingStateException(
        meetingId,
        "not_found",
        "update",
      );
    }

    // Validate state
    if (meeting.status !== MeetingStatus.SCHEDULED) {
      throw new InvalidMeetingStateException(
        meetingId,
        meeting.status,
        "update",
      );
    }

    // Call provider to update
    const provider = this.providerFactory.getProvider(
      meeting.meetingProvider as any,
    );

    await provider.updateMeeting(meeting.meetingId, {
      topic: dto.topic,
      startTime: dto.startTime ? new Date(dto.startTime) : undefined,
      duration: dto.duration,
      autoRecord: dto.autoRecord,
    });

    this.logger.debug(
      `Meeting updated on provider: ${meeting.meetingProvider}`,
    );

    // Update database
    const updated = await this.meetingRepo.update(meetingId, {
      topic: dto.topic || meeting.topic,
      scheduleStartTime: dto.startTime
        ? new Date(dto.startTime)
        : meeting.scheduleStartTime,
      scheduleDuration: dto.duration || meeting.scheduleDuration,
    });

    this.logger.log(`Meeting updated successfully: ${meetingId}`);

    return updated;
  }

  /**
   * Cancel a meeting
   *
   * @param meetingId - Meeting UUID
   * @returns True if cancelled successfully
   */
  async cancelMeeting(meetingId: string): Promise<boolean> {
    this.logger.debug(`Cancelling meeting: ${meetingId}`);

    // Fetch meeting
    const meeting = await this.meetingRepo.findById(meetingId);

    if (!meeting) {
      throw new InvalidMeetingStateException(
        meetingId,
        "not_found",
        "cancel",
      );
    }

    // Only scheduled meetings can be cancelled
    if (meeting.status !== MeetingStatus.SCHEDULED) {
      throw new InvalidMeetingStateException(
        meetingId,
        meeting.status,
        "cancel",
      );
    }

    // Call provider to cancel
    const provider = this.providerFactory.getProvider(
      meeting.meetingProvider as any,
    );

    await provider.cancelMeeting(meeting.meetingId);

    this.logger.debug(
      `Meeting cancelled on provider: ${meeting.meetingProvider}`,
    );

    // Update status to expired
    await this.meetingRepo.update(meetingId, {
      status: MeetingStatus.EXPIRED,
    });

    this.logger.log(`Meeting cancelled successfully: ${meetingId}`);

    return true;
  }

  /**
   * Get meeting by ID
   *
   * @param meetingId - Meeting UUID
   * @returns Meeting entity
   */
  async getMeetingById(meetingId: string): Promise<Meeting | null> {
    return this.meetingRepo.findById(meetingId);
  }

  /**
   * Get meeting info (for API responses)
   *
   * @param meetingId - Meeting UUID
   * @returns Meeting info DTO
   */
  async getMeetingInfo(meetingId: string): Promise<MeetingInfoDto | null> {
    const meeting = await this.meetingRepo.findById(meetingId);

    if (!meeting) {
      return null;
    }

    return {
      provider: meeting.meetingProvider as any,
      meetingId: meeting.meetingId,
      meetingNo: meeting.meetingNo,
      meetingUrl: meeting.meetingUrl,
      meetingPassword: null, // Not stored in meetings table
      hostJoinUrl: null, // Not stored in meetings table
      startTime: meeting.scheduleStartTime,
      duration: meeting.scheduleDuration,
    };
  }
}

