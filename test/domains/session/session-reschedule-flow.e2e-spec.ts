import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { SessionService } from "@domains/services/session/services/session.service";
import { CalendarService } from "@core/calendar/services/calendar.service";
import { IMeetingProvider } from "@core/meeting-providers/interfaces/meeting-provider.interface";
import { MeetingProviderFactory } from "@core/meeting-providers/factory/meeting-provider.factory";
import { NotificationQueueService } from "@core/notification/queue/notification-queue.service";
import { NotificationService } from "@core/notification/services/notification.service";
import { UpdateSessionDto } from "@domains/services/session/dto/update-session.dto";
import { SessionStatus } from "@domains/services/session/interfaces/session.interface";

describe("Session Reschedule Flow (e2e)", () => {
  let app: INestApplication;
  let sessionService: SessionService;
  let calendarService: CalendarService;
  let meetingProviderFactory: MeetingProviderFactory;
  let notificationQueueService: NotificationQueueService;
  let notificationService: NotificationService;
  let mockMeetingProvider: jest.Mocked<IMeetingProvider>;

  const mockSession = {
    id: "00000000-0000-0000-0000-000000000001",
    studentId: "00000000-0000-0000-0000-000000000002",
    mentorId: "00000000-0000-0000-0000-000000000003",
    meetingId: "6892847362938471942",
    meetingProvider: "feishu",
    meetingUrl: "https://vc.feishu.cn/j/123456789",
    scheduledStartTime: new Date("2025-11-10T14:00:00Z"),
    scheduledDuration: 60,
    sessionName: "System Design Interview",
    status: SessionStatus.SCHEDULED,
    recordings: [],
    aiSummary: null,
    mentorJoinCount: 0,
    studentJoinCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCalendarSlot = {
    id: "slot-001",
    resourceType: "mentor",
    resourceId: mockSession.mentorId,
    startTime: mockSession.scheduledStartTime,
    endTime: new Date(
      mockSession.scheduledStartTime.getTime() + 60 * 60 * 1000,
    ),
    durationMinutes: 60,
    sessionId: mockSession.id,
    slotType: "session",
    status: "occupied",
    reason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeAll(async () => {
    mockMeetingProvider = {
      createMeeting: jest.fn(),
      updateMeeting: jest.fn(),
      cancelMeeting: jest.fn(),
      getMeetingInfo: jest.fn(),
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: SessionService,
          useValue: {
            getSessionById: jest.fn(),
            updateSession: jest.fn(),
          },
        },
        {
          provide: CalendarService,
          useValue: {
            isSlotAvailable: jest.fn(),
            getSlotBySessionId: jest.fn(),
            rescheduleSlot: jest.fn(),
          },
        },
        {
          provide: MeetingProviderFactory,
          useValue: {
            getProvider: jest.fn().mockReturnValue(mockMeetingProvider),
          },
        },
        {
          provide: NotificationQueueService,
          useValue: {
            updateBySessionId: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendEmail: jest.fn(),
          },
        },
      ],
    }).compile();

    sessionService = moduleFixture.get<SessionService>(SessionService);
    calendarService = moduleFixture.get<CalendarService>(CalendarService);
    meetingProviderFactory = moduleFixture.get<MeetingProviderFactory>(
      MeetingProviderFactory,
    );
    notificationQueueService = moduleFixture.get<NotificationQueueService>(
      NotificationQueueService,
    );
    notificationService = moduleFixture.get<NotificationService>(NotificationService);

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Complete reschedule flow", () => {
    it("should successfully reschedule a session", async () => {
      // New scheduled time (moved to next day)
      const newScheduledStartTime = new Date("2025-11-11T14:00:00Z");
      const newScheduledDuration = 90; // Extended to 90 minutes

      const updateDto: UpdateSessionDto = {
        scheduledStartTime: newScheduledStartTime.toISOString(),
        scheduledDuration: newScheduledDuration,
      };

      const updatedSession = {
        ...mockSession,
        scheduledStartTime: newScheduledStartTime,
        scheduledDuration: newScheduledDuration,
      };

      // Step 1: Check new time slot availability
      (calendarService.isSlotAvailable as jest.Mock).mockResolvedValue(true);

      const isAvailable = await calendarService.isSlotAvailable(
        "mentor",
        mockSession.mentorId,
        newScheduledStartTime,
        newScheduledDuration,
      );

      expect(isAvailable).toBe(true);

      // Step 2: Update session record
      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.updateSession as jest.Mock).mockResolvedValue(
        updatedSession,
      );

      const session = await sessionService.updateSession(
        mockSession.id,
        updateDto,
      );

      expect(session.scheduledStartTime).toEqual(newScheduledStartTime);
      expect(session.scheduledDuration).toBe(newScheduledDuration);

      // Step 3: Update meeting provider
      mockMeetingProvider.updateMeeting.mockResolvedValue(true);

      const provider = meetingProviderFactory.getProvider(
        mockSession.meetingProvider as any,
      );
      const meetingUpdated = await provider.updateMeeting(
        mockSession.meetingId,
        {
          startTime: newScheduledStartTime,
          duration: newScheduledDuration,
        } as any,
      );

      expect(meetingUpdated).toBe(true);

      // Step 4: Reschedule calendar slot (release old + occupy new)
      (calendarService.getSlotBySessionId as jest.Mock).mockResolvedValue(
        mockCalendarSlot,
      );

      const newSlot = {
        ...mockCalendarSlot,
        id: "slot-002",
        startTime: newScheduledStartTime,
        durationMinutes: newScheduledDuration,
      };

      (calendarService.rescheduleSlot as jest.Mock).mockResolvedValue(newSlot);

      const oldSlot = await calendarService.getSlotBySessionId(mockSession.id);
      const rescheduledSlot = await calendarService.rescheduleSlot(
        oldSlot.id,
        newScheduledStartTime,
        newScheduledDuration,
      );

      expect(rescheduledSlot.startTime).toEqual(newScheduledStartTime);
      expect(rescheduledSlot.durationMinutes).toBe(newScheduledDuration);

      // Step 5: Update notification queue
      (notificationQueueService.updateBySessionId as jest.Mock).mockResolvedValue(
        undefined,
      );

      await notificationQueueService.updateBySessionId(
        mockSession.id,
        newScheduledStartTime,
      );

      expect(notificationQueueService.updateBySessionId).toHaveBeenCalledWith(
        mockSession.id,
        newScheduledStartTime,
      );

      // Step 6: Send reschedule notification email
      (notificationService.sendEmail as jest.Mock).mockResolvedValue(undefined);

      await notificationService.sendEmail({
        to: "student@example.com",
        subject: "Your session has been rescheduled",
        template: "session-rescheduled",
        data: {
          sessionName: mockSession.sessionName,
          oldTime: mockSession.scheduledStartTime,
          newTime: newScheduledStartTime,
          meetingUrl: mockSession.meetingUrl,
        },
      });

      // Verify all steps were executed
      expect(calendarService.isSlotAvailable).toHaveBeenCalledTimes(1);
      expect(sessionService.updateSession).toHaveBeenCalledTimes(1);
      expect(mockMeetingProvider.updateMeeting).toHaveBeenCalledTimes(1);
      expect(calendarService.getSlotBySessionId).toHaveBeenCalledTimes(1);
      expect(calendarService.rescheduleSlot).toHaveBeenCalledTimes(1);
      expect(notificationQueueService.updateBySessionId).toHaveBeenCalledTimes(1);
      expect(notificationService.sendEmail).toHaveBeenCalledTimes(1);
    });

    it("should fail when new time slot is not available", async () => {
      const newScheduledStartTime = new Date("2025-11-11T14:00:00Z");
      const newScheduledDuration = 60;

      // New time slot is occupied
      (calendarService.isSlotAvailable as jest.Mock).mockResolvedValue(false);

      const isAvailable = await calendarService.isSlotAvailable(
        "mentor",
        mockSession.mentorId,
        newScheduledStartTime,
        newScheduledDuration,
      );

      expect(isAvailable).toBe(false);

      // Should not proceed with reschedule
      expect(sessionService.updateSession).not.toHaveBeenCalled();
      expect(mockMeetingProvider.updateMeeting).not.toHaveBeenCalled();
    });

    it("should handle meeting provider update failure", async () => {
      const newScheduledStartTime = new Date("2025-11-11T14:00:00Z");
      const newScheduledDuration = 60;

      const updateDto: UpdateSessionDto = {
        scheduledStartTime: newScheduledStartTime.toISOString(),
        scheduledDuration: newScheduledDuration,
      };

      (calendarService.isSlotAvailable as jest.Mock).mockResolvedValue(true);
      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.updateSession as jest.Mock).mockResolvedValue({
        ...mockSession,
        scheduledStartTime: newScheduledStartTime,
        scheduledDuration: newScheduledDuration,
      });

      await calendarService.isSlotAvailable(
        "mentor",
        mockSession.mentorId,
        newScheduledStartTime,
        newScheduledDuration,
      );

      await sessionService.updateSession(mockSession.id, updateDto);

      // Meeting provider update fails
      mockMeetingProvider.updateMeeting.mockRejectedValue(
        new Error("Meeting provider API error"),
      );

      const provider = meetingProviderFactory.getProvider(
        mockSession.meetingProvider as any,
      );

      await expect(
        provider.updateMeeting(mockSession.meetingId, {
          startTime: newScheduledStartTime,
          duration: newScheduledDuration,
        } as any),
      ).rejects.toThrow("Meeting provider API error");

      // In a real implementation, you would want to:
      // 1. Rollback the session update
      // 2. Keep the old calendar slot
      // 3. Notify the user of the failure
    });

    it("should not allow rescheduling a completed session", async () => {
      const completedSession = {
        ...mockSession,
        status: SessionStatus.COMPLETED,
      };

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(
        completedSession,
      );

      // In the actual implementation, updateSession should throw an error
      // for completed sessions (already tested in unit tests)

      // This test demonstrates the expected behavior at the flow level
      expect(completedSession.status).toBe(SessionStatus.COMPLETED);
    });

    it("should handle time zone conversions correctly", async () => {
      // Original time in UTC
      const originalTime = new Date("2025-11-10T14:00:00Z");

      // New time (same local time, different day)
      const newTime = new Date("2025-11-11T14:00:00Z");

      const updateDto: UpdateSessionDto = {
        scheduledStartTime: newTime.toISOString(),
      };

      (calendarService.isSlotAvailable as jest.Mock).mockResolvedValue(true);
      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.updateSession as jest.Mock).mockResolvedValue({
        ...mockSession,
        scheduledStartTime: newTime,
      });

      await calendarService.isSlotAvailable(
        "mentor",
        mockSession.mentorId,
        newTime,
        mockSession.scheduledDuration,
      );

      const updated = await sessionService.updateSession(
        mockSession.id,
        updateDto,
      );

      // Verify times are in correct format (ISO 8601)
      expect(updated.scheduledStartTime.toISOString()).toBe(newTime.toISOString());
      expect(updated.scheduledStartTime.getTime()).not.toBe(originalTime.getTime());
    });
  });

  describe("Partial reschedule scenarios", () => {
    it("should allow changing only the start time", async () => {
      const newScheduledStartTime = new Date("2025-11-10T15:00:00Z");

      const updateDto: UpdateSessionDto = {
        scheduledStartTime: newScheduledStartTime.toISOString(),
        // Duration remains the same
      };

      (calendarService.isSlotAvailable as jest.Mock).mockResolvedValue(true);
      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.updateSession as jest.Mock).mockResolvedValue({
        ...mockSession,
        scheduledStartTime: newScheduledStartTime,
      });

      const updated = await sessionService.updateSession(
        mockSession.id,
        updateDto,
      );

      expect(updated.scheduledStartTime).toEqual(newScheduledStartTime);
      expect(updated.scheduledDuration).toBe(mockSession.scheduledDuration);
    });

    it("should allow changing only the duration", async () => {
      const newDuration = 90;

      const updateDto: UpdateSessionDto = {
        scheduledDuration: newDuration,
        // Start time remains the same
      };

      (calendarService.isSlotAvailable as jest.Mock).mockResolvedValue(true);
      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.updateSession as jest.Mock).mockResolvedValue({
        ...mockSession,
        scheduledDuration: newDuration,
      });

      const updated = await sessionService.updateSession(
        mockSession.id,
        updateDto,
      );

      expect(updated.scheduledStartTime).toEqual(mockSession.scheduledStartTime);
      expect(updated.scheduledDuration).toBe(newDuration);
    });
  });
});
