import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { Test } from "@nestjs/testing";
import { PlacementModule } from "@domains/placement/placement.module";
import { JobApplicationService } from "@domains/placement/services/job-application.service";
import { JobPositionService } from "@domains/placement/services/job-position.service";
import {
  ISubmitApplicationDto,
  ISubmitMentorScreeningDto,
} from "@domains/placement/dto/job-application.dto";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";

import { v4 as uuidv4 } from "uuid";
import { TestDatabaseHelper } from "../../utils/test-database.helper";
import { ApplicationType } from "@domains/placement/types/application-type.enum";

/**
 * Mentor Referral Flow E2E Tests
 * Comprehensive integration tests for mentor referral job application process
 * [内推流程集成测试]
 */
describe("Mentor Referral Flow (e2e)", () => {
  let app: INestApplication;
  let jobApplicationService: JobApplicationService;
  let jobPositionService: JobPositionService;
  let eventEmitter: EventEmitter2;
  let testDatabaseHelper: TestDatabaseHelper;

  // Test data
  const testStudentId = uuidv4();
  const testMentorId = uuidv4();
  let testApplicationId: string;

  beforeAll(async () => {
    // Create a mock event emitter that we can spy on
    const mockEventEmitter = new EventEmitter2();

    // Create testing module with all required dependencies
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        DatabaseModule,
        PlacementModule, // Add PlacementModule to access its services
        EventEmitterModule.forRoot(),
      ],
      providers: [
        // Override the EventEmitter2 provider with our mock instance
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    // Initialize test database helper
    testDatabaseHelper = new TestDatabaseHelper();
    // Override the moduleRef with our own that includes PlacementModule
    (testDatabaseHelper as any).moduleRef = moduleRef;
    (testDatabaseHelper as any).db =
      moduleRef.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);

    // Get services from module
    jobApplicationService = moduleRef.get<JobApplicationService>(
      JobApplicationService,
    );
    jobPositionService = moduleRef.get<JobPositionService>(JobPositionService);
    eventEmitter = mockEventEmitter; // Use our mock event emitter

    // Create nest application
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // Close application and database connection
    if (app) {
      await app.close();
    }
    if (testDatabaseHelper) {
      await testDatabaseHelper.close();
    }
  });

  beforeEach(async () => {
    // Clean up test data before each test
    await testDatabaseHelper.cleanupTables([
      "application_history",
      "job_applications",
      "recommended_jobs",
    ]);
  });

  describe("Mentor Referral Application Submission", () => {
    it("should submit a mentor referral job application successfully", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer (Mentor Referral)",
        companyName: "Tech Company",
        description: "Test job description for mentor referral",
        requirements: ["Strong technical skills", "Good communication"],
        locations: [{ name: "Remote" }],
        salaryMin: 120000,
        salaryMax: 160000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit mentor referral application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.REFERRAL,
        coverLetter: "Test cover letter for mentor referral",
        customAnswers: {
          referralMentor: testMentorId,
          referralReason: "Strong technical background and cultural fit",
          previousExperience: "5+ years in software development",
        },
      };

      const result = await jobApplicationService.submitApplication(dto);
      testApplicationId = result.data.id;

      // Verify application was created successfully
      expect(result.data).toBeDefined();
      expect(result.data.studentId).toBe(testStudentId);
      expect(result.data.jobId).toBe(jobResult.data.id);
      expect(result.data.applicationType).toBe(ApplicationType.REFERRAL);
      expect(result.data.status).toBe("recommended");
      expect(result.event).toBeDefined();
      expect(result.event?.type).toBe("placement.application.submitted");
    }, 30000); // 30s timeout for database operations

    it("should submit mentor screening for referral application", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: ["Technical skills", "Team player"],
        locations: [{ name: "On-site" }],
        salaryMin: 110000,
        salaryMax: 140000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit mentor referral application
      const submitDto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.REFERRAL,
        coverLetter: "Test cover letter",
        customAnswers: { referralMentor: testMentorId },
      };

      const submitResult =
        await jobApplicationService.submitApplication(submitDto);
      testApplicationId = submitResult.data.id;

      // Update status to interested first
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "interested",
        changedBy: uuidv4(),
        changeReason: "Student is interested",
      });

      // Update status to mentor_assigned
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "mentor_assigned",
        changedBy: uuidv4(),
        changeReason: "Counselor assigned mentor",
      });

      // Submit mentor screening
      const screeningDto: ISubmitMentorScreeningDto = {
        applicationId: testApplicationId,
        mentorId: testMentorId,
        technicalSkills: 5,
        experienceMatch: 4,
        culturalFit: 5,
        overallRecommendation: "strongly_recommend",
        screeningNotes:
          "Excellent candidate with strong technical skills and cultural fit",
      };

      const screeningResult =
        await jobApplicationService.submitMentorScreening(screeningDto);

      // Verify screening was submitted successfully
      expect(screeningResult.data).toBeDefined();
      expect(screeningResult.data.mentorScreening).toBeDefined();
      const mentorScreening = screeningResult.data.mentorScreening as Record<
        string,
        any
      >;
      expect(mentorScreening?.technicalSkills).toBe(5);
      expect(mentorScreening?.overallRecommendation).toBe("strongly_recommend");
      expect(screeningResult.event).toBeDefined();
      expect(screeningResult.event?.type).toBe(
        "placement.mentor_screening.completed",
      );
    }, 35000);

    it("should throw error if submitting mentor screening for non-referral application", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: ["Technical skills"],
        locations: [{ name: "Remote" }],
        salaryMin: 100000,
        salaryMax: 130000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit direct application (not mentor referral)
      const submitDto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.DIRECT,
        coverLetter: "Test cover letter",
        customAnswers: {},
      };

      const submitResult =
        await jobApplicationService.submitApplication(submitDto);
      testApplicationId = submitResult.data.id;

      // Try to submit mentor screening for non-referral application
      const screeningDto: ISubmitMentorScreeningDto = {
        applicationId: testApplicationId,
        mentorId: testMentorId,
        technicalSkills: 4,
        experienceMatch: 4,
        culturalFit: 4,
        overallRecommendation: "recommend",
        screeningNotes: "Good candidate",
      };

      await expect(
        jobApplicationService.submitMentorScreening(screeningDto),
      ).rejects.toThrow();
    }, 25000);

    it("should throw error if submitting mentor screening for non-mentor_assigned application", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: ["Technical skills"],
        locations: [{ name: "Remote" }],
        salaryMin: 100000,
        salaryMax: 130000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit mentor referral application
      const submitDto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.REFERRAL,
        coverLetter: "Test cover letter",
        customAnswers: { referralMentor: testMentorId },
      };

      const submitResult =
        await jobApplicationService.submitApplication(submitDto);
      testApplicationId = submitResult.data.id;

      // Try to submit mentor screening for recommended application (should fail)
      const screeningDto: ISubmitMentorScreeningDto = {
        applicationId: testApplicationId,
        mentorId: testMentorId,
        technicalSkills: 4,
        experienceMatch: 4,
        culturalFit: 4,
        overallRecommendation: "recommend",
        screeningNotes: "Good candidate",
      };

      await expect(
        jobApplicationService.submitMentorScreening(screeningDto),
      ).rejects.toThrow();
    }, 30000);

    it("should update referral application status after mentor screening", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: ["Technical skills", "Communication"],
        locations: [{ name: "Hybrid" }],
        salaryMin: 120000,
        salaryMax: 150000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit mentor referral application
      const submitDto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.REFERRAL,
        coverLetter: "Test cover letter",
        customAnswers: { referralMentor: testMentorId },
      };

      const submitResult =
        await jobApplicationService.submitApplication(submitDto);
      testApplicationId = submitResult.data.id;

      // Update status to interested first
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "interested",
        changedBy: uuidv4(),
        changeReason: "Student is interested",
      });

      // Update status to mentor_assigned
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "mentor_assigned",
        changedBy: uuidv4(),
        changeReason: "Counselor assigned mentor",
      });

      // Submit mentor screening
      const screeningDto: ISubmitMentorScreeningDto = {
        applicationId: testApplicationId,
        mentorId: testMentorId,
        technicalSkills: 5,
        experienceMatch: 5,
        culturalFit: 5,
        overallRecommendation: "strongly_recommend",
        screeningNotes: "Excellent candidate",
      };

      await jobApplicationService.submitMentorScreening(screeningDto);

      // Update status to interviewed based on positive screening
      const updateResult = await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "interviewed",
        changedBy: uuidv4(),
        changeReason: "Positive mentor screening",
      });

      expect(updateResult.data.status).toBe("interviewed");
      expect(updateResult.event).toBeDefined();
      expect(updateResult.event?.type).toBe(
        "placement.application.status_changed",
      );
    }, 35000);
  });

  describe("Mentor Referral Application Management", () => {
    it("should retrieve referral application with mentor screening", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Senior Developer",
        companyName: "Enterprise Company",
        description: "Senior developer position",
        requirements: ["5+ years experience", "Leadership skills"],
        locations: [{ name: "Remote" }],
        salaryMin: 140000,
        salaryMax: 180000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit mentor referral application
      const submitDto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.REFERRAL,
        coverLetter: "Test cover letter",
        customAnswers: { referralMentor: testMentorId },
      };

      const submitResult =
        await jobApplicationService.submitApplication(submitDto);
      testApplicationId = submitResult.data.id;

      // Update status to interested first
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "interested",
        changedBy: uuidv4(),
        changeReason: "Student is interested",
      });

      // Update status to mentor_assigned
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "mentor_assigned",
        changedBy: uuidv4(),
        changeReason: "Counselor assigned mentor",
      });

      // Submit mentor screening
      const screeningDto: ISubmitMentorScreeningDto = {
        applicationId: testApplicationId,
        mentorId: testMentorId,
        technicalSkills: 4,
        experienceMatch: 5,
        culturalFit: 4,
        overallRecommendation: "recommend",
        screeningNotes: "Strong candidate with relevant experience",
      };

      await jobApplicationService.submitMentorScreening(screeningDto);

      // Retrieve application by ID
      const retrievedApplication = await jobApplicationService.findOne({
        id: testApplicationId,
      });

      expect(retrievedApplication).toBeDefined();
      expect(retrievedApplication.mentorScreening).toBeDefined();
      const mentorScreening = retrievedApplication.mentorScreening as Record<
        string,
        any
      >;
      expect(mentorScreening?.technicalSkills).toBe(4);
      expect(mentorScreening?.overallRecommendation).toBe("recommend");
      expect(retrievedApplication.applicationType).toBe(
        ApplicationType.REFERRAL,
      );
    }, 30000);

    it("should record complete status history for referral applications", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: ["Technical skills", "Problem solving"],
        locations: [{ name: "Remote" }],
        salaryMin: 100000,
        salaryMax: 130000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit mentor referral application
      const submitDto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.REFERRAL,
        coverLetter: "Test cover letter",
        customAnswers: { referralMentor: testMentorId },
      };

      const submitResult =
        await jobApplicationService.submitApplication(submitDto);
      testApplicationId = submitResult.data.id;

      // Update status to interested
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "interested",
        changedBy: uuidv4(),
        changeReason: "Student is interested",
      });

      // Update status to mentor_assigned
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "mentor_assigned",
        changedBy: uuidv4(),
        changeReason: "Counselor assigned mentor",
      });

      // Submit mentor screening
      const screeningDto: ISubmitMentorScreeningDto = {
        applicationId: testApplicationId,
        mentorId: testMentorId,
        technicalSkills: 5,
        experienceMatch: 5,
        culturalFit: 5,
        overallRecommendation: "strongly_recommend",
        screeningNotes: "Exceptional candidate",
      };

      await jobApplicationService.submitMentorScreening(screeningDto);

      // Update status through full lifecycle
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "interviewed",
        changedBy: uuidv4(),
        changeReason: "Positive mentor screening",
      });

      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "got_offer",
        changedBy: uuidv4(),
        changeReason: "Successful interviews",
      });

      // Get status history
      const history =
        await jobApplicationService.getStatusHistory(testApplicationId);

      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThanOrEqual(5); // Should have at least 5 status changes: recommended → interested → mentor_assigned → submitted → interviewed → got_offer

      // Verify specific status changes
      const statuses = history.map((h) => h.newStatus);
      expect(statuses).toContain("interested");
      expect(statuses).toContain("mentor_assigned");
      expect(statuses).toContain("interviewed");
      expect(statuses).toContain("got_offer");
    }, 40000);
  });

  describe("Event-Driven Integration for Mentor Referrals", () => {
    it("should publish application submitted event for referral applications", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Developer",
        companyName: "Tech Startup",
        description: "Software developer position",
        requirements: ["Coding skills", "Teamwork"],
        locations: [{ name: "On-site" }],
        salaryMin: 110000,
        salaryMax: 140000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit mentor referral application
      const submitDto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.REFERRAL,
        coverLetter: "Test cover letter",
        customAnswers: { referralMentor: testMentorId },
      };

      await jobApplicationService.submitApplication(submitDto);

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith(
        "placement.application.submitted",
        expect.any(Object),
      );
    }, 25000);

    it("should publish mentor screening completed event", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: ["Technical skills"],
        locations: [{ name: "Remote" }],
        salaryMin: 100000,
        salaryMax: 130000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit mentor referral application
      const submitDto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.REFERRAL,
        coverLetter: "Test cover letter",
        customAnswers: { referralMentor: testMentorId },
      };

      const submitResult =
        await jobApplicationService.submitApplication(submitDto);
      testApplicationId = submitResult.data.id;

      // Update status to interested
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "interested",
        changedBy: uuidv4(),
        changeReason: "Student is interested",
      });

      // Update status to mentor_assigned
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "mentor_assigned",
        changedBy: uuidv4(),
        changeReason: "Counselor assigned mentor",
      });

      // Submit mentor screening
      const screeningDto: ISubmitMentorScreeningDto = {
        applicationId: testApplicationId,
        mentorId: testMentorId,
        technicalSkills: 5,
        experienceMatch: 5,
        culturalFit: 5,
        overallRecommendation: "strongly_recommend",
        screeningNotes: "Excellent candidate",
      };

      await jobApplicationService.submitMentorScreening(screeningDto);

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith(
        "placement.mentor_screening.completed",
        expect.any(Object),
      );
    }, 30000);
  });
});
