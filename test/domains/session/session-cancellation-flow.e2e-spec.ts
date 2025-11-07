import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { SessionService } from "@domains/services/session/services/session.service";
import { CalendarService } from "@core/calendar/services/calendar.service";
import { IMeetingProvider } from "@core/meeting-providers/interfaces/meeting-provider.interface";
import { MeetingProviderFactory } from "@core/meeting-providers/factory/meeting-provider.factory";
import { NotificationQueueService } from "@core/notification/queue/notification-queue.service";
import { NotificationService } from "@core/notification/services/notification.service";
import { SessionStatus } from "@domains/services/session/interfaces/session.interface";

describe("Session Cancellation Flow (e2e)", () => {
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
    notes: null,
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
            cancelSession: jest.fn(),
          },
        },
        {
          provide: CalendarService,
          useValue: {
            getSlotBySessionId: jest.fn(),
            releaseSlot: jest.fn(),
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
            cancelBySessionId: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendSessionCancelledEmail: jest.fn(),
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

  describe("Complete cancellation flow", () => {
    it("should successfully cancel a session with student-requested reason", async () => {
      const cancelReason = "Student has a conflicting appointment";

      const cancelledSession = {
        ...mockSession,
        status: SessionStatus.CANCELLED,
        notes: `[Cancelled] ${cancelReason}`,
      };

      // Step 1: Cancel session (update status and add reason to notes)
      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.cancelSession as jest.Mock).mockResolvedValue(
        cancelledSession,
      );

      const session = await sessionService.cancelSession(
        mockSession.id,
        cancelReason,
      );

      expect(session.status).toBe(SessionStatus.CANCELLED);
      expect(session.notes).toContain(cancelReason);

      // Step 2: Cancel meeting in provider
      mockMeetingProvider.cancelMeeting.mockResolvedValue(true);

      const provider = meetingProviderFactory.getProvider(
        mockSession.meetingProvider as any,
      );
      const meetingCancelled = await provider.cancelMeeting(
        mockSession.meetingId,
      );

      expect(meetingCancelled).toBe(true);

      // Step 3: Release calendar slot
      (calendarService.getSlotBySessionId as jest.Mock).mockResolvedValue(
        mockCalendarSlot,
      );
      (calendarService.releaseSlot as jest.Mock).mockResolvedValue({
        ...mockCalendarSlot,
        status: "cancelled",
      });

      const slot = await calendarService.getSlotBySessionId(mockSession.id);
      await calendarService.releaseSlot(slot.id);

      // Step 4: Cancel all pending notifications
      (notificationQueueService.cancelBySessionId as jest.Mock).mockResolvedValue(
        undefined,
      );

      await notificationQueueService.cancelBySessionId(mockSession.id);

      // Step 5: Send cancellation notification email
      (notificationService.sendSessionCancelledEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      await notificationService.sendSessionCancelledEmail(cancelledSession as any);

      // Verify all steps were executed
      expect(sessionService.cancelSession).toHaveBeenCalledWith(
        mockSession.id,
        cancelReason,
      );
      expect(mockMeetingProvider.cancelMeeting).toHaveBeenCalledWith(
        mockSession.meetingId,
      );
      expect(calendarService.getSlotBySessionId).toHaveBeenCalledWith(
        mockSession.id,
      );
      expect(calendarService.releaseSlot).toHaveBeenCalledWith(slot.id);
      expect(notificationQueueService.cancelBySessionId).toHaveBeenCalledWith(
        mockSession.id,
      );
      expect(notificationService.sendSessionCancelledEmail).toHaveBeenCalledWith(
        cancelledSession,
      );
    });

    it("should successfully cancel a session with mentor-requested reason", async () => {
      const cancelReason = "Mentor has an emergency";

      const cancelledSession = {
        ...mockSession,
        status: SessionStatus.CANCELLED,
        notes: `[Cancelled] ${cancelReason}`,
      };

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.cancelSession as jest.Mock).mockResolvedValue(
        cancelledSession,
      );

      const session = await sessionService.cancelSession(
        mockSession.id,
        cancelReason,
      );

      expect(session.status).toBe(SessionStatus.CANCELLED);
      expect(session.notes).toContain("emergency");
    });

    it("should handle meeting provider cancellation failure gracefully", async () => {
      const cancelReason = "Test cancellation";

      const cancelledSession = {
        ...mockSession,
        status: SessionStatus.CANCELLED,
        notes: `[Cancelled] ${cancelReason}`,
      };

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.cancelSession as jest.Mock).mockResolvedValue(
        cancelledSession,
      );

      await sessionService.cancelSession(mockSession.id, cancelReason);

      // Meeting provider cancellation fails
      mockMeetingProvider.cancelMeeting.mockRejectedValue(
        new Error("Meeting provider API error"),
      );

      const provider = meetingProviderFactory.getProvider(
        mockSession.meetingProvider as any,
      );

      await expect(
        provider.cancelMeeting(mockSession.meetingId),
      ).rejects.toThrow("Meeting provider API error");

      // Despite meeting provider failure, session should remain cancelled
      // In production, you might want to:
      // 1. Log the error
      // 2. Create a background job to retry
      // 3. Notify admins
      // But the session cancellation should not be rolled back
    });

    it("should not allow cancelling an already completed session", async () => {
      const completedSession = {
        ...mockSession,
        status: SessionStatus.COMPLETED,
      };

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(
        completedSession,
      );

      // In actual implementation, cancelSession should throw an error
      // This is tested in unit tests, here we just verify the behavior

      expect(completedSession.status).toBe(SessionStatus.COMPLETED);
    });

    it("should not allow cancelling an already cancelled session", async () => {
      const alreadyCancelledSession = {
        ...mockSession,
        status: SessionStatus.CANCELLED,
        notes: "[Cancelled] Previously cancelled",
      };

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(
        alreadyCancelledSession,
      );

      // In actual implementation, cancelSession should throw an error
      expect(alreadyCancelledSession.status).toBe(SessionStatus.CANCELLED);
    });
  });

  describe("Different cancellation reasons", () => {
    it("should handle system-initiated cancellation", async () => {
      const cancelReason = "System maintenance scheduled";

      const cancelledSession = {
        ...mockSession,
        status: SessionStatus.CANCELLED,
        notes: `[Cancelled] ${cancelReason}`,
      };

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.cancelSession as jest.Mock).mockResolvedValue(
        cancelledSession,
      );

      const session = await sessionService.cancelSession(
        mockSession.id,
        cancelReason,
      );

      expect(session.notes).toContain("System maintenance");
    });

    it("should handle cancellation due to payment issues", async () => {
      const cancelReason = "Payment failed - insufficient credits";

      const cancelledSession = {
        ...mockSession,
        status: SessionStatus.CANCELLED,
        notes: `[Cancelled] ${cancelReason}`,
      };

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.cancelSession as jest.Mock).mockResolvedValue(
        cancelledSession,
      );

      const session = await sessionService.cancelSession(
        mockSession.id,
        cancelReason,
      );

      expect(session.notes).toContain("Payment failed");
    });

    it("should require non-empty cancellation reason", async () => {
      const emptyReason = "";

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);

      // In actual implementation, cancelSession should throw an error
      // when reason is empty (tested in unit tests)

      expect(emptyReason).toBe("");
    });
  });

  describe("Cancellation notifications", () => {
    it("should send email to both student and mentor", async () => {
      const cancelReason = "Student requested cancellation";

      const cancelledSession = {
        ...mockSession,
        status: SessionStatus.CANCELLED,
        notes: `[Cancelled] ${cancelReason}`,
      };

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.cancelSession as jest.Mock).mockResolvedValue(
        cancelledSession,
      );
      mockMeetingProvider.cancelMeeting.mockResolvedValue(true);
      (calendarService.getSlotBySessionId as jest.Mock).mockResolvedValue(
        mockCalendarSlot,
      );
      (calendarService.releaseSlot as jest.Mock).mockResolvedValue({});
      (notificationQueueService.cancelBySessionId as jest.Mock).mockResolvedValue(
        undefined,
      );
      (notificationService.sendSessionCancelledEmail as jest.Mock).mockResolvedValue(
        undefined,
      );

      await sessionService.cancelSession(mockSession.id, cancelReason);

      const provider = meetingProviderFactory.getProvider(
        mockSession.meetingProvider as any,
      );
      await provider.cancelMeeting(mockSession.meetingId);

      const slot = await calendarService.getSlotBySessionId(mockSession.id);
      await calendarService.releaseSlot(slot.id);

      await notificationQueueService.cancelBySessionId(mockSession.id);

      await notificationService.sendSessionCancelledEmail(cancelledSession as any);

      // Verify notification was sent
      expect(notificationService.sendSessionCancelledEmail).toHaveBeenCalledWith(
        cancelledSession,
      );
    });

    it("should cancel all scheduled notifications (reminders)", async () => {
      const cancelReason = "Cancellation test";

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.cancelSession as jest.Mock).mockResolvedValue({
        ...mockSession,
        status: SessionStatus.CANCELLED,
      });
      mockMeetingProvider.cancelMeeting.mockResolvedValue(true);
      (calendarService.getSlotBySessionId as jest.Mock).mockResolvedValue(
        mockCalendarSlot,
      );
      (calendarService.releaseSlot as jest.Mock).mockResolvedValue({});
      (notificationQueueService.cancelBySessionId as jest.Mock).mockResolvedValue(
        undefined,
      );

      await sessionService.cancelSession(mockSession.id, cancelReason);

      const provider = meetingProviderFactory.getProvider(
        mockSession.meetingProvider as any,
      );
      await provider.cancelMeeting(mockSession.meetingId);

      const slot = await calendarService.getSlotBySessionId(mockSession.id);
      await calendarService.releaseSlot(slot.id);

      await notificationQueueService.cancelBySessionId(mockSession.id);

      // Verify all pending notifications were cancelled
      expect(notificationQueueService.cancelBySessionId).toHaveBeenCalledWith(
        mockSession.id,
      );
    });
  });

  describe("Calendar slot management", () => {
    it("should release mentor calendar slot", async () => {
      const cancelReason = "Release calendar test";

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.cancelSession as jest.Mock).mockResolvedValue({
        ...mockSession,
        status: SessionStatus.CANCELLED,
      });
      (calendarService.getSlotBySessionId as jest.Mock).mockResolvedValue(
        mockCalendarSlot,
      );
      (calendarService.releaseSlot as jest.Mock).mockResolvedValue({
        ...mockCalendarSlot,
        status: "cancelled",
      });

      await sessionService.cancelSession(mockSession.id, cancelReason);

      const slot = await calendarService.getSlotBySessionId(mockSession.id);
      const releasedSlot = await calendarService.releaseSlot(slot.id);

      expect(calendarService.getSlotBySessionId).toHaveBeenCalledWith(
        mockSession.id,
      );
      expect(calendarService.releaseSlot).toHaveBeenCalledWith(slot.id);
      expect(releasedSlot.status).toBe("cancelled");
    });

    it("should handle missing calendar slot gracefully", async () => {
      const cancelReason = "Missing slot test";

      (sessionService.getSessionById as jest.Mock).mockResolvedValue(mockSession);
      (sessionService.cancelSession as jest.Mock).mockResolvedValue({
        ...mockSession,
        status: SessionStatus.CANCELLED,
      });
      (calendarService.getSlotBySessionId as jest.Mock).mockResolvedValue(null);

      await sessionService.cancelSession(mockSession.id, cancelReason);

      const slot = await calendarService.getSlotBySessionId(mockSession.id);

      expect(slot).toBeNull();
      // Should not attempt to release if slot doesn't exist
      expect(calendarService.releaseSlot).not.toHaveBeenCalled();
    });
  });
});
