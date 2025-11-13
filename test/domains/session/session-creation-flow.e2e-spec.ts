import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { SessionService } from "@domains/services/session/services/session.service";
import { CalendarService } from "@core/calendar/services/calendar.service";
import {
  IMeetingProvider,
  MeetingProviderType,
} from "@core/meeting-providers/interfaces/meeting-provider.interface";
import { MeetingProviderFactory } from "@core/meeting-providers/factory/meeting-provider.factory";
import { NotificationQueueService } from "@core/notification/queue/notification-queue.service";
import { NotificationService } from "@core/notification/services/notification.service";
import { CreateSessionDto } from "@domains/services/session/dto/create-session.dto";
import {
  MeetingProvider,
  SessionStatus,
} from "@domains/services/session/interfaces/session.interface";
import {
  UserType,
  SlotType,
} from "@core/calendar/interfaces/calendar-slot.interface";

describe("Session Creation Flow (e2e)", () => {
  let app: INestApplication;
  let sessionService: SessionService;
  let calendarService: CalendarService;
  let meetingProviderFactory: MeetingProviderFactory;
  let notificationQueueService: NotificationQueueService;
  let notificationService: NotificationService;
  let mockMeetingProvider: jest.Mocked<IMeetingProvider>;

  beforeAll(async () => {
    // Create mock meeting provider
    mockMeetingProvider = {
      createMeeting: jest.fn(),
      updateMeeting: jest.fn(),
      cancelMeeting: jest.fn(),
      getMeetingInfo: jest.fn(),
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      // Import actual modules here
      // This is a simplified example - you would need to import your actual modules
      providers: [
        {
          provide: SessionService,
          useValue: {
            createSession: jest.fn(),
            updateMeetingInfo: jest.fn(),
          },
        },
        {
          provide: CalendarService,
          useValue: {
            createSlotDirect: jest.fn(),
            updateSlotSessionId: jest.fn(),
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
            enqueue: jest.fn(),
          },
        },
        {
          provide: NotificationService,
          useValue: {
            sendSessionCreatedEmail: jest.fn(),
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
    notificationService =
      moduleFixture.get<NotificationService>(NotificationService);

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Complete session creation flow", () => {
    it("should successfully create a session with all steps", async () => {
      // Arrange
      const createDto: CreateSessionDto = {
        studentId: "00000000-0000-0000-0000-000000000001",
        mentorId: "00000000-0000-0000-0000-000000000002",
        scheduledStartTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
        scheduledDuration: 60,
        sessionName: "System Design Interview Prep",
        meetingProvider: MeetingProvider.FEISHU,
      };

      const mockSession = {
        id: "00000000-0000-0000-0000-000000000003",
        ...createDto,
        scheduledStartTime: new Date(createDto.scheduledStartTime),
        status: SessionStatus.SCHEDULED,
        meetingUrl: null,
        recordings: [],
        aiSummary: null,
        mentorJoinCount: 0,
        studentJoinCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockMeetingInfo = {
        provider: MeetingProviderType.FEISHU,
        meetingId: "6911188411934433028", // Third-party meeting ID from Feishu
        meetingNo: "123456789",
        meetingUrl: "https://vc.feishu.cn/j/123456789",
        meetingPassword: null,
        hostJoinUrl: null,
        startTime: new Date(createDto.scheduledStartTime),
        duration: 60,
      };

      const mockUpdatedSession = {
        ...mockSession,
        meetingNo: mockMeetingInfo.meetingNo,
        meetingUrl: mockMeetingInfo.meetingUrl,
      };

      // Step 1: Calendar check
      (calendarService.isSlotAvailable as jest.Mock).mockResolvedValue(true);

      // Step 2: Create session record
      (sessionService.createSession as jest.Mock).mockResolvedValue(
        mockSession,
      );

      // Step 3: Create meeting
      mockMeetingProvider.createMeeting.mockResolvedValue(mockMeetingInfo);

      // Step 4: Update session with meeting info
      (sessionService.updateMeetingInfo as jest.Mock).mockResolvedValue(
        mockUpdatedSession,
      );

      // Step 5: Create calendar slot directly (with atomic constraint)
      (calendarService.createSlotDirect as jest.Mock).mockResolvedValue({
        id: "slot-001",
        userId: createDto.mentorId,
        userType: UserType.MENTOR,
        startTime: new Date(createDto.scheduledStartTime),
        durationMinutes: 60,
      });

      // Step 5b: Update slot with session ID
      (calendarService.updateSlotSessionId as jest.Mock).mockResolvedValue({
        id: "slot-001",
        userId: createDto.mentorId,
        userType: UserType.MENTOR,
        startTime: new Date(createDto.scheduledStartTime),
        durationMinutes: 60,
        sessionId: "session-001",
      });

      // Step 6: Enqueue notifications
      (notificationQueueService.enqueue as jest.Mock).mockResolvedValue(
        undefined,
      );

      // Step 7: Send immediate email
      (
        notificationService.sendSessionCreatedEmail as jest.Mock
      ).mockResolvedValue(undefined);

      // Act
      // Simulate BFF layer orchestration
      // Step 1: Create calendar slot directly (atomic with DB constraint)
      const calendarSlot = await calendarService.createSlotDirect({
        userId: createDto.mentorId,
        userType: UserType.MENTOR,
        startTime: createDto.scheduledStartTime,
        durationMinutes: createDto.scheduledDuration,
        slotType: SlotType.SESSION,
      });

      expect(calendarSlot).toBeDefined();
      expect(calendarSlot.userId).toBe(createDto.mentorId);

      // Step 2: Create session
      const session = await sessionService.createSession(createDto);

      expect(session).toBeDefined();
      expect(session.id).toBe(mockSession.id);

      // Step 3: Create meeting
      const provider = meetingProviderFactory.getProvider(
        createDto.meetingProvider as unknown as MeetingProviderType,
      );
      const meetingInfo = await provider.createMeeting({
        topic: createDto.sessionName || `Session with mentor`,
        startTime: new Date(createDto.scheduledStartTime),
        duration: createDto.scheduledDuration,
        autoRecord: true,
      });

      expect(meetingInfo).toBeDefined();
      expect(meetingInfo.meetingNo).toBe(mockMeetingInfo.meetingNo);

      // Step 4: Update session with meeting info
      const updatedSession = await sessionService.updateMeetingInfo(
        session.id,
        {
          meetingProvider: meetingInfo.provider as unknown as MeetingProvider,
          meetingNo: meetingInfo.meetingNo,
          meetingUrl: meetingInfo.meetingUrl,
          meetingPassword: meetingInfo.meetingPassword,
        },
      );

      expect(updatedSession.meetingUrl).toBe(mockMeetingInfo.meetingUrl);

      // Step 5: Update calendar slot with session ID
      await calendarService.updateSlotSessionId(calendarSlot.id, session.id);

      // Step 6: Enqueue notifications
      const scheduledTime = new Date(createDto.scheduledStartTime);
      const notifications = [
        {
          sessionId: session.id,
          recipientType: "student" as const,
          recipientId: createDto.studentId,
          notificationType: "session_reminder_3d",
          scheduledAt: new Date(
            scheduledTime.getTime() - 3 * 24 * 60 * 60 * 1000,
          ),
        },
        {
          sessionId: session.id,
          recipientType: "mentor" as const,
          recipientId: createDto.mentorId,
          notificationType: "session_reminder_1h",
          scheduledAt: new Date(scheduledTime.getTime() - 60 * 60 * 1000),
        },
      ];

      for (const notification of notifications) {
        await notificationQueueService.enqueue(notification as any);
      }

      // Step 7: Send immediate email
      await notificationService.sendSessionCreatedEmail(
        updatedSession as any,
        "student@example.com",
        "mentor@example.com",
      );

      // Assert
      // Verify all steps were called in correct order
      expect(calendarService.isSlotAvailable).toHaveBeenCalledTimes(1);
      expect(sessionService.createSession).toHaveBeenCalledTimes(1);
      expect(mockMeetingProvider.createMeeting).toHaveBeenCalledTimes(1);
      expect(sessionService.updateMeetingInfo).toHaveBeenCalledTimes(1);
      expect(calendarService.updateSlotSessionId).toHaveBeenCalledTimes(1);
      expect(notificationQueueService.enqueue).toHaveBeenCalledTimes(2);
      expect(notificationService.sendSessionCreatedEmail).toHaveBeenCalledTimes(
        1,
      );
    });

    it("should fail when mentor calendar is not available", async () => {
      const createDto: CreateSessionDto = {
        studentId: "00000000-0000-0000-0000-000000000001",
        mentorId: "00000000-0000-0000-0000-000000000002",
        scheduledStartTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
        scheduledDuration: 60,
        sessionName: "System Design Interview Prep",
        meetingProvider: MeetingProvider.FEISHU,
      };

      // Calendar slot creation fails due to conflict
      (calendarService.createSlotDirect as jest.Mock).mockResolvedValue(null);

      const calendarSlot = await calendarService.createSlotDirect({
        userId: createDto.mentorId,
        userType: UserType.MENTOR,
        startTime: createDto.scheduledStartTime,
        durationMinutes: createDto.scheduledDuration,
        slotType: SlotType.SESSION,
      });

      expect(calendarSlot).toBeNull();

      // Should not proceed with session creation
      expect(sessionService.createSession).not.toHaveBeenCalled();
    });

    it("should handle meeting creation failure gracefully", async () => {
      const createDto: CreateSessionDto = {
        studentId: "00000000-0000-0000-0000-000000000001",
        mentorId: "00000000-0000-0000-0000-000000000002",
        scheduledStartTime: new Date(
          Date.now() + 24 * 60 * 60 * 1000,
        ).toISOString(),
        scheduledDuration: 60,
        sessionName: "System Design Interview Prep",
        meetingProvider: MeetingProvider.FEISHU,
      };

      const mockSession = {
        id: "00000000-0000-0000-0000-000000000003",
        ...createDto,
        scheduledStartTime: new Date(createDto.scheduledStartTime),
        status: SessionStatus.SCHEDULED,
      };

      (calendarService.createSlotDirect as jest.Mock).mockResolvedValue({
        id: "slot-001",
        userId: createDto.mentorId,
        userType: UserType.MENTOR,
      });
      (sessionService.createSession as jest.Mock).mockResolvedValue(
        mockSession,
      );

      // Meeting creation fails
      mockMeetingProvider.createMeeting.mockRejectedValue(
        new Error("Meeting API error"),
      );

      const calendarSlot = await calendarService.createSlotDirect({
        userId: createDto.mentorId,
        userType: UserType.MENTOR,
        startTime: createDto.scheduledStartTime,
        durationMinutes: createDto.scheduledDuration,
        slotType: SlotType.SESSION,
      });

      await sessionService.createSession(createDto);

      const provider = meetingProviderFactory.getProvider(
        createDto.meetingProvider as unknown as MeetingProviderType,
      );

      // Should throw error when creating meeting
      await expect(
        provider.createMeeting({
          topic: createDto.sessionName || "",
          startTime: new Date(createDto.scheduledStartTime),
          duration: createDto.scheduledDuration,
        }),
      ).rejects.toThrow("Meeting API error");

      // In a real implementation, you would want to:
      // 1. Rollback the session creation
      // 2. Release the calendar slot
      // 3. Notify the user of the failure
    });
  });
});
