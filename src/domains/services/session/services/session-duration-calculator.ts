import { Injectable, Logger } from "@nestjs/common";
import { SessionEventRepository } from "../repositories/session-event.repository";
import { SessionService } from "./session.service";
import {
  IDurationStats,
  ITimeInterval,
  IParticipantSession,
} from "../interfaces/duration-stats.interface";

/**
 * Session Duration Calculator
 *
 * Calculates session duration statistics from session_events
 * Uses event sourcing to track mentor/student join/leave events
 */
@Injectable()
export class SessionDurationCalculator {
  private readonly logger = new Logger(SessionDurationCalculator.name);

  constructor(
    private readonly sessionEventRepository: SessionEventRepository,
    private readonly sessionService: SessionService,
  ) {}

  /**
   * Calculate duration statistics for a session
   *
   * @param sessionId - Session ID
   * @returns Duration statistics
   */
  async calculateDurations(sessionId: string): Promise<IDurationStats> {
    this.logger.debug(`Calculating durations for session: ${sessionId}`);

    // Get session to extract student and mentor IDs
    const session = await this.sessionService.getSessionById(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Get all join/leave events for this session
    const events =
      await this.sessionEventRepository.findJoinLeaveEvents(sessionId);

    // Parse events into participant sessions
    const participantSessions = this.parseParticipantSessions(
      events,
      session.studentId,
      session.mentorId,
    );

    // Separate mentor and student sessions
    const mentorSessions = participantSessions.filter(
      (s) => s.role === "mentor",
    );
    const studentSessions = participantSessions.filter(
      (s) => s.role === "student",
    );

    // Calculate total durations
    const mentorTotalDuration = this.calculateTotalDuration(mentorSessions);
    const studentTotalDuration = this.calculateTotalDuration(studentSessions);

    // Calculate overlapping intervals (effective tutoring time)
    const overlapIntervals = this.calculateOverlapIntervals(
      mentorSessions,
      studentSessions,
    );
    const effectiveTutoringDuration =
      this.sumIntervalDurations(overlapIntervals);

    // Count join events
    const mentorJoinCount = mentorSessions.length;
    const studentJoinCount = studentSessions.length;

    const stats: IDurationStats = {
      mentorTotalDurationSeconds: mentorTotalDuration,
      studentTotalDurationSeconds: studentTotalDuration,
      effectiveTutoringDurationSeconds: effectiveTutoringDuration,
      mentorJoinCount,
      studentJoinCount,
      overlapIntervals,
    };

    this.logger.debug(
      `Duration calculation complete: Mentor=${mentorTotalDuration}s, Student=${studentTotalDuration}s, Effective=${effectiveTutoringDuration}s`,
    );

    return stats;
  }

  /**
   * Parse session events into participant sessions (join/leave pairs)
   *
   * @param events - Array of join/leave events
   * @param studentId - Student user ID
   * @param mentorId - Mentor user ID
   * @returns Array of participant sessions
   */
  private parseParticipantSessions(
    events: Array<{
      eventType: string;
      eventData: unknown;
      occurredAt: Date;
    }>,
    studentId: string,
    mentorId: string,
  ): IParticipantSession[] {
    const sessions: IParticipantSession[] = [];
    const activeUsers = new Map<
      string,
      { role: "mentor" | "student"; joinTime: Date }
    >();

    for (const event of events) {
      const eventData = event.eventData as {
        user?: { id?: string; user_id?: string };
        participant?: { user_id?: string };
      };

      // Extract user ID from event data (format varies by platform)
      const userId =
        eventData.user?.id ||
        eventData.user?.user_id ||
        eventData.participant?.user_id ||
        "";

      // Determine role
      let role: "mentor" | "student" | null = null;
      if (userId === mentorId) {
        role = "mentor";
      } else if (userId === studentId) {
        role = "student";
      }

      if (!role) {
        this.logger.warn(`Unknown user in event: ${userId}`);
        continue;
      }

      // Handle join event
      if (
        event.eventType === "vc.meeting.join_meeting_v1" ||
        event.eventType === "meeting.participant_joined"
      ) {
        activeUsers.set(userId, { role, joinTime: event.occurredAt });
      }

      // Handle leave event
      if (
        event.eventType === "vc.meeting.leave_meeting_v1" ||
        event.eventType === "meeting.participant_left"
      ) {
        const activeUser = activeUsers.get(userId);
        if (activeUser) {
          // Create completed session
          sessions.push({
            userId,
            role: activeUser.role,
            joinTime: activeUser.joinTime,
            leaveTime: event.occurredAt,
          });
          activeUsers.delete(userId);
        }
      }
    }

    // Handle users still in meeting (no leave event yet)
    for (const [userId, activeUser] of activeUsers.entries()) {
      sessions.push({
        userId,
        role: activeUser.role,
        joinTime: activeUser.joinTime,
        leaveTime: null, // Still in meeting
      });
    }

    return sessions;
  }

  /**
   * Calculate total duration for a list of participant sessions
   *
   * @param sessions - Participant sessions
   * @returns Total duration in seconds
   */
  private calculateTotalDuration(sessions: IParticipantSession[]): number {
    let totalSeconds = 0;

    for (const session of sessions) {
      if (session.leaveTime) {
        const durationMs =
          session.leaveTime.getTime() - session.joinTime.getTime();
        totalSeconds += Math.floor(durationMs / 1000);
      } else {
        // User still in meeting, calculate until now
        const durationMs = Date.now() - session.joinTime.getTime();
        totalSeconds += Math.floor(durationMs / 1000);
      }
    }

    return totalSeconds;
  }

  /**
   * Calculate overlapping intervals between mentor and student sessions
   *
   * @param mentorSessions - Mentor sessions
   * @param studentSessions - Student sessions
   * @returns Array of overlapping time intervals
   */
  private calculateOverlapIntervals(
    mentorSessions: IParticipantSession[],
    studentSessions: IParticipantSession[],
  ): ITimeInterval[] {
    const overlaps: ITimeInterval[] = [];

    for (const mentorSession of mentorSessions) {
      for (const studentSession of studentSessions) {
        const mentorEnd = mentorSession.leaveTime || new Date(); // Use current time if still in meeting
        const studentEnd = studentSession.leaveTime || new Date();

        // Check if intervals overlap
        const overlapStart = new Date(
          Math.max(
            mentorSession.joinTime.getTime(),
            studentSession.joinTime.getTime(),
          ),
        );
        const overlapEnd = new Date(
          Math.min(mentorEnd.getTime(), studentEnd.getTime()),
        );

        if (overlapStart < overlapEnd) {
          overlaps.push({
            start: overlapStart,
            end: overlapEnd,
          });
        }
      }
    }

    return overlaps;
  }

  /**
   * Sum durations of time intervals
   *
   * @param intervals - Time intervals
   * @returns Total duration in seconds
   */
  private sumIntervalDurations(intervals: ITimeInterval[]): number {
    let totalSeconds = 0;

    for (const interval of intervals) {
      const durationMs = interval.end.getTime() - interval.start.getTime();
      totalSeconds += Math.floor(durationMs / 1000);
    }

    return totalSeconds;
  }
}
