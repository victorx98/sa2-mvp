/**
 * Gap Analysis Session Mapper
 * Transforms database entities to API response DTOs with unified format
 */
export class GapAnalysisSessionMapper {
  /**
   * Map session entity to response DTO with optimistic update strategy
   * Merges latest session values into meeting object for consistent UX
   * 
   * @param entity Session entity with optional meeting relationship
   * @returns Mapped session response DTO
   */
  static toResponseDto(entity: any): any {
    if (!entity) {
      return null;
    }

    const response: any = {
      id: entity.id,
      meetingId: entity.meetingId,
      sessionType: entity.sessionType,
      sessionTypeId: entity.sessionTypeId,
      studentUserId: entity.studentUserId,
      mentorUserId: entity.mentorUserId,
      createdByCounselorId: entity.createdByCounselorId,
      // Add user names from query service
      studentName: entity.studentName || null,
      mentorName: entity.mentorName || null,
      counselorName: entity.counselorName || null,
      title: entity.title,
      description: entity.description,
      status: entity.status,
      scheduledAt: entity.scheduledAt,
      completedAt: entity.completedAt,
      cancelledAt: entity.cancelledAt,
      deletedAt: entity.deletedAt,
      aiSummaries: entity.aiSummaries || [],
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };

    // Build meeting object with optimistic update strategy
    // Priority: session values > meeting values (for immediate user feedback)
    if (entity.meeting) {
      response.meeting = {
        id: entity.meeting.id,
        meetingNo: entity.meeting.meetingNo,
        meetingProvider: entity.meeting.meetingProvider,
        meetingId: entity.meeting.meetingId,
        // Use latest session title as meeting topic
        topic: entity.title || entity.meeting.topic,
        meetingUrl: entity.meeting.meetingUrl,
        ownerId: entity.meeting.ownerId,
        // Use latest session scheduledAt as meeting start time
        scheduleStartTime: entity.scheduledAt || entity.meeting.scheduleStartTime,
        // Use latest duration from session or fallback to meeting
        scheduleDuration: entity.duration || entity.meeting.scheduleDuration,
        status: entity.meeting.status,
        actualDuration: entity.meeting.actualDuration,
        meetingTimeList: entity.meeting.meetingTimeList || [],
        recordingUrl: entity.meeting.recordingUrl,
        lastMeetingEndedTimestamp: entity.meeting.lastMeetingEndedTimestamp,
        pendingTaskId: entity.meeting.pendingTaskId,
        createdAt: entity.meeting.createdAt,
        updatedAt: entity.meeting.updatedAt,
      };
    }

    return response;
  }

  /**
   * Map array of session entities to response DTOs
   * @param entities Array of session entities
   * @returns Array of mapped session response DTOs
   */
  static toResponseDtos(entities: any[]): any[] {
    return entities.map((entity) => this.toResponseDto(entity));
  }
}

