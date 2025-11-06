import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  eq,
  and,
  gte,
  lte,
  desc,
  asc,
  isNull,
  sql,
  like,
  inArray,
} from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { ISessionEntity } from "../interfaces/session.interface";
import { QueryFiltersDto, PaginationDto } from "../dto/query-filters.dto";
import {
  IPaginatedResult,
  ISessionStats,
  IDateRange,
} from "../interfaces/query-result.interface";

/**
 * Session Query Service
 *
 * Provides advanced query functionality for sessions
 * Includes filtering, pagination, and statistics
 */
@Injectable()
export class SessionQueryService {
  private readonly logger = new Logger(SessionQueryService.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  /**
   * Find sessions by student ID with filters and pagination
   *
   * @param studentId - Student user ID
   * @param filters - Query filters
   * @param pagination - Pagination parameters
   * @returns Paginated session list
   */
  async findByStudentId(
    studentId: string,
    filters: QueryFiltersDto = {},
    pagination: PaginationDto = {},
  ): Promise<IPaginatedResult<ISessionEntity>> {
    this.logger.debug(`Querying sessions for student: ${studentId}`);

    return this.queryWithFilters(
      eq(schema.sessions.studentId, studentId),
      filters,
      pagination,
    );
  }

  /**
   * Find sessions by mentor ID with filters and pagination
   *
   * @param mentorId - Mentor user ID
   * @param filters - Query filters
   * @param pagination - Pagination parameters
   * @returns Paginated session list
   */
  async findByMentorId(
    mentorId: string,
    filters: QueryFiltersDto = {},
    pagination: PaginationDto = {},
  ): Promise<IPaginatedResult<ISessionEntity>> {
    this.logger.debug(`Querying sessions for mentor: ${mentorId}`);

    return this.queryWithFilters(
      eq(schema.sessions.mentorId, mentorId),
      filters,
      pagination,
    );
  }

  /**
   * Find upcoming sessions for a user
   *
   * @param userId - User ID (student or mentor)
   * @param role - User role ('student' or 'mentor')
   * @param limit - Maximum number of sessions to return
   * @returns Array of upcoming sessions
   */
  async findUpcomingSessions(
    userId: string,
    role: "student" | "mentor",
    limit: number = 10,
  ): Promise<ISessionEntity[]> {
    this.logger.debug(`Finding upcoming sessions for ${role}: ${userId}`);

    const now = new Date();
    const userCondition =
      role === "student"
        ? eq(schema.sessions.studentId, userId)
        : eq(schema.sessions.mentorId, userId);

    const sessions = await this.db
      .select()
      .from(schema.sessions)
      .where(
        and(
          userCondition,
          gte(schema.sessions.scheduledStartTime, now),
          inArray(schema.sessions.status, ["scheduled", "started"]),
          isNull(schema.sessions.deletedAt),
        ),
      )
      .orderBy(asc(schema.sessions.scheduledStartTime))
      .limit(limit);

    return sessions.map((s) => this.mapToEntity(s));
  }

  /**
   * Get session statistics for a user
   *
   * @param userId - User ID
   * @param role - User role
   * @param dateRange - Date range filter
   * @returns Session statistics
   */
  async getSessionStatistics(
    userId: string,
    role: "student" | "mentor",
    dateRange?: IDateRange,
  ): Promise<ISessionStats> {
    this.logger.debug(`Calculating statistics for ${role}: ${userId}`);

    const userCondition =
      role === "student"
        ? eq(schema.sessions.studentId, userId)
        : eq(schema.sessions.mentorId, userId);

    const conditions = [userCondition, isNull(schema.sessions.deletedAt)];

    if (dateRange) {
      conditions.push(
        gte(schema.sessions.scheduledStartTime, dateRange.startDate),
      );
      conditions.push(
        lte(schema.sessions.scheduledStartTime, dateRange.endDate),
      );
    }

    // Get all sessions matching criteria
    const sessions = await this.db
      .select()
      .from(schema.sessions)
      .where(and(...conditions));

    // Calculate statistics
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(
      (s) => s.status === "completed",
    ).length;
    const cancelledSessions = sessions.filter(
      (s) => s.status === "cancelled",
    ).length;

    // Calculate total duration in hours
    const totalDurationSeconds = sessions.reduce((sum, session) => {
      return sum + (session.effectiveTutoringDurationSeconds || 0);
    }, 0);
    const totalDurationHours = totalDurationSeconds / 3600;

    // Calculate average duration in minutes
    const averageDurationMinutes =
      completedSessions > 0 ? totalDurationSeconds / completedSessions / 60 : 0;

    // Calculate completion rate
    const completionRate =
      totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

    return {
      totalSessions,
      completedSessions,
      cancelledSessions,
      totalDurationHours: Math.round(totalDurationHours * 100) / 100,
      averageDurationMinutes: Math.round(averageDurationMinutes * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100,
    };
  }

  /**
   * Query sessions with filters and pagination
   *
   * @param baseCondition - Base WHERE condition
   * @param filters - Additional filters
   * @param pagination - Pagination parameters
   * @returns Paginated result
   */
  private async queryWithFilters(
    baseCondition: any,
    filters: QueryFiltersDto,
    pagination: PaginationDto,
  ): Promise<IPaginatedResult<ISessionEntity>> {
    const conditions = [baseCondition, isNull(schema.sessions.deletedAt)];

    // Apply status filter
    if (filters.status && filters.status.length > 0) {
      conditions.push(inArray(schema.sessions.status, filters.status as any));
    }

    // Apply date range filter
    if (filters.dateFrom) {
      conditions.push(
        gte(schema.sessions.scheduledStartTime, new Date(filters.dateFrom)),
      );
    }
    if (filters.dateTo) {
      conditions.push(
        lte(schema.sessions.scheduledStartTime, new Date(filters.dateTo)),
      );
    }

    // Apply keyword filter (search in session name)
    if (filters.keyword) {
      conditions.push(
        like(schema.sessions.sessionName, `%${filters.keyword}%`),
      );
    }

    // Apply recording filter
    if (filters.hasRecording !== undefined) {
      if (filters.hasRecording) {
        conditions.push(
          sql`jsonb_array_length(${schema.sessions.recordings}) > 0`,
        );
      } else {
        conditions.push(
          sql`jsonb_array_length(${schema.sessions.recordings}) = 0`,
        );
      }
    }

    // Get total count
    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.sessions)
      .where(and(...conditions));
    const total = Number(totalResult[0].count);

    // Calculate pagination
    const page = pagination.page || 1;
    const limit = Math.min(pagination.limit || 20, 100);
    const offset = (page - 1) * limit;

    // Determine sort order
    const orderByField =
      pagination.order === "asc"
        ? asc(schema.sessions.scheduledStartTime)
        : desc(schema.sessions.scheduledStartTime);

    // Query with pagination
    const sessions = await this.db
      .select()
      .from(schema.sessions)
      .where(and(...conditions))
      .orderBy(orderByField)
      .limit(limit)
      .offset(offset);

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return {
      data: sessions.map((s) => this.mapToEntity(s)),
      total,
      page,
      limit,
      totalPages,
      hasNext,
      hasPrev,
    };
  }

  /**
   * Map database record to entity
   */
  private mapToEntity(
    record: typeof schema.sessions.$inferSelect,
  ): ISessionEntity {
    return {
      id: record.id,
      studentId: record.studentId,
      mentorId: record.mentorId,
      contractId: record.contractId,
      meetingProvider: record.meetingProvider,
      meetingId: record.meetingId,
      meetingNo: record.meetingNo,
      meetingUrl: record.meetingUrl,
      meetingPassword: record.meetingPassword,
      scheduledStartTime: record.scheduledStartTime,
      scheduledDuration: record.scheduledDuration,
      actualStartTime: record.actualStartTime,
      actualEndTime: record.actualEndTime,
      recordings: (record.recordings as unknown as any[]) || [],
      aiSummary: (record.aiSummary as unknown as any) || null,
      mentorTotalDurationSeconds: record.mentorTotalDurationSeconds,
      studentTotalDurationSeconds: record.studentTotalDurationSeconds,
      effectiveTutoringDurationSeconds: record.effectiveTutoringDurationSeconds,
      mentorJoinCount: record.mentorJoinCount,
      studentJoinCount: record.studentJoinCount,
      sessionName: record.sessionName,
      notes: record.notes,
      status: record.status as any,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt,
    };
  }
}
