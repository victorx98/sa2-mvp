import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { EventEmitter2, EventEmitterModule } from "@nestjs/event-emitter";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { PlacementModule } from "@domains/placement/placement.module";
import { JobApplicationService } from "@domains/placement/services/job-application.service";
import { JobPositionService } from "@domains/placement/services/job-position.service";
import { ISubmitApplicationDto } from "@domains/placement/dto/job-application.dto";

import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { v4 as uuidv4 } from "uuid";
import { sql } from "drizzle-orm";

/**
 * Agent Application Flow E2E Tests
 * Comprehensive integration tests for agent-assisted job application process
 * [代投流程集成测试]
 */
describe("Agent Application Flow (e2e)", () => {
  let app: INestApplication;
  let jobApplicationService: JobApplicationService;
  let jobPositionService: JobPositionService;
  let eventEmitter: EventEmitter2;
  let db: NodePgDatabase;

  // Test data
  const testStudentId = uuidv4();
  const testJobId = uuidv4();
  let testApplicationId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          envFilePath: ".env",
          isGlobal: true,
        }),
        EventEmitterModule.forRoot({
          wildcard: true,
          delimiter: ".",
        }),
        DatabaseModule,
        PlacementModule,
      ],
    }).compile();

    jobApplicationService = moduleFixture.get<JobApplicationService>(JobApplicationService);
    jobPositionService = moduleFixture.get<JobPositionService>(JobPositionService);
    eventEmitter = moduleFixture.get<EventEmitter2>(EventEmitter2);
    db = moduleFixture.get<NodePgDatabase>(DATABASE_CONNECTION);

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clean up test data before each test
    // Note: This requires careful execution order to avoid foreign key constraints
    if (testApplicationId) {
      await db.execute(sql`DELETE FROM application_history WHERE application_id = ${testApplicationId}`);
      await db.execute(sql`DELETE FROM job_applications WHERE id = ${testApplicationId}`);
    }
    await db.execute(sql`DELETE FROM recommended_jobs WHERE id = ${testJobId}`);
  });

  describe("Agent Application Submission", () => {
    it("should submit an agent-assisted job application successfully", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer (Agent Test)",
        companyName: "Test Tech Company",
        description: "Test job description with agent-assisted application process",
        requirements: ["Strong coding skills", "Experience with TypeScript"],
        locations: [{ name: "Remote" }],
        salaryMin: 120000,
        salaryMax: 180000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),

      });

      // Submit agent-assisted application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: "counselor_assisted", // Agent applications are counselor-assisted
        coverLetter: "Test cover letter for agent-assisted application",
        customAnswers: { 
          codingChallengeScore: 95, 
          codeSampleUrl: "https://github.com/test/portfolio",
          technicalSkills: ["TypeScript", "Node.js", "React"]
        },

      };

      const result = await jobApplicationService.submitApplication(dto);
      testApplicationId = result.data.id;

      // Verify application was created successfully
      expect(result.data).toBeDefined();
      expect(result.data.studentId).toBe(testStudentId);
      expect(result.data.jobId).toBe(jobResult.data.id);
      expect(result.data.applicationType).toBe("counselor_assisted");
      expect(result.data.status).toBe("submitted");
      expect(result.data.isUrgent).toBe(false);
    }, 30000); // 30s timeout for database operations

    it("should handle agent application with minimal required fields", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Junior Developer",
        companyName: "Startup Company",
        description: "Entry-level developer position",
        requirements: ["Basic coding skills"],
        locations: [{ name: "On-site" }],
        salaryMin: 80000,
        salaryMax: 100000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),

      });

      // Submit agent application with minimal fields
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: "counselor_assisted",
        // No cover letter or custom answers provided

      };

      const result = await jobApplicationService.submitApplication(dto);
      testApplicationId = result.data.id;

      expect(result.data).toBeDefined();
      expect(result.data.coverLetter).toBeNull();
      expect(result.data.customAnswers).toBeNull();
    }, 25000);

    it("should update agent application status through the full lifecycle", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Senior Engineer",
        companyName: "Tech Giant",
        description: "Senior developer position",
        requirements: ["Advanced coding skills", "5+ years experience"],
        locations: [{ name: "Hybrid" }],
        salaryMin: 150000,
        salaryMax: 200000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),

      });

      // Submit application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: "counselor_assisted",
        coverLetter: "Test cover letter",
        customAnswers: { codingChallengeScore: 90 },

      };

      const submitResult = await jobApplicationService.submitApplication(dto);
      testApplicationId = submitResult.data.id;

      // Update status through full lifecycle according to design document
      // Path 1: submitted → interviewed → got_offer
      let updateResult = await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "interviewed",
        changedBy: uuidv4(),
        changeReason: "Moving to interviewed",
      });
      expect(updateResult.data.status).toBe("interviewed");

      updateResult = await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "got_offer",
        changedBy: uuidv4(),
        changeReason: "Moving to got_offer",
      });
      expect(updateResult.data.status).toBe("got_offer");
    }, 40000); // Longer timeout for multiple status updates

    it("should handle urgent agent applications", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Urgent Developer Role",
        companyName: "Fast-growing Startup",
        description: "Urgent developer opening",
        requirements: ["Quick learner", "Ability to work under pressure"],
        locations: [{ name: "Remote" }],
        salaryMin: 100000,
        salaryMax: 130000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit urgent agent application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: "counselor_assisted",
        coverLetter: "Urgent application - available immediately",
        customAnswers: { availability: "Immediate", codingExperience: "3 years" },
        isUrgent: true,
      };

      const result = await jobApplicationService.submitApplication(dto);
      testApplicationId = result.data.id;

      expect(result.data.isUrgent).toBe(true);
      expect(result.data.applicationType).toBe("counselor_assisted");
    }, 25000);

    it("should throw error if job position does not exist", async () => {
      // Try to submit application for non-existent job
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: uuidv4(), // Non-existent job ID
        applicationType: "counselor_assisted",
        coverLetter: "Test cover letter",
        customAnswers: { codingChallengeScore: 85 },

      };

      await expect(jobApplicationService.submitApplication(dto)).rejects.toThrow();
    }, 15000);
  });

  describe("Agent Application Management", () => {
    it("should retrieve agent application with custom answers", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Full Stack Developer",
        companyName: "Mid-sized Company",
        description: "Full stack developer position",
        requirements: ["Frontend and backend skills"],
        locations: [{ name: "Hybrid" }],
        salaryMin: 120000,
        salaryMax: 150000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),

      });

      // Submit application with detailed custom answers
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: "counselor_assisted",
        coverLetter: "Test cover letter",
        customAnswers: { 
          codingChallengeScore: 92, 
          codeSampleUrl: "https://github.com/test/portfolio",
          technicalSkills: ["TypeScript", "Node.js", "React", "PostgreSQL"],
          projectExperience: ["Built e-commerce platform", "Developed REST APIs"]
        },

      };

      const submitResult = await jobApplicationService.submitApplication(dto);
      testApplicationId = submitResult.data.id;

      // Retrieve application by ID
      const retrievedApplication = await jobApplicationService.findOne({ id: testApplicationId });

      expect(retrievedApplication).toBeDefined();
      expect(retrievedApplication.customAnswers).toBeDefined();
      const customAnswers = retrievedApplication.customAnswers as Record<string, any>;
      expect(customAnswers?.codingChallengeScore).toBe(92);
      expect(customAnswers?.technicalSkills).toHaveLength(4);
    }, 25000);

    it("should record status change history for agent applications", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "DevOps Engineer",
        companyName: "Cloud Company",
        description: "DevOps engineer position",
        requirements: ["Cloud experience", "CI/CD skills"],
        locations: [{ name: "Remote" }],
        salaryMin: 130000,
        salaryMax: 160000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),

      });

      // Submit application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: "counselor_assisted",
        coverLetter: "Test cover letter",
        customAnswers: { cloudExperience: "AWS, GCP" },

      };

      const submitResult = await jobApplicationService.submitApplication(dto);
      testApplicationId = submitResult.data.id;

      // Update status multiple times according to design document
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "interviewed",
        changedBy: uuidv4(),
        changeReason: "Moving to interviewed",
      });

      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "got_offer",
        changedBy: uuidv4(),
        changeReason: "Received offer",
      });

      // Get status history
      const history = await jobApplicationService.getStatusHistory(testApplicationId);

      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThanOrEqual(2); // Should have at least 2 status changes
      
      // Verify specific status changes
      const statuses = history.map(h => h.newStatus);
      expect(statuses).toContain("interviewed");
      expect(statuses).toContain("got_offer");
    }, 35000);
  });

  describe("Event-Driven Integration for Agent Applications", () => {
    it("should publish application submitted event for agent applications", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Developer",
        companyName: "Enterprise Company",
        description: "Software developer position",
        requirements: ["Strong coding skills", "Team player"],
        locations: [{ name: "On-site" }],
        salaryMin: 110000,
        salaryMax: 140000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),

      });

      // Submit agent application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: "counselor_assisted",
        coverLetter: "Test cover letter",
        customAnswers: { codingSkills: "TypeScript, Python" },

      };

      await jobApplicationService.submitApplication(dto);

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith(
        "placement.application.submitted",
        expect.any(Object)
      );
    }, 25000);

    it("should publish status changed event for agent applications", async () => {
      const eventSpy = jest.spyOn(eventEmitter, "emit");

      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "QA Engineer",
        companyName: "Testing Company",
        description: "QA engineer position",
        requirements: ["Testing skills", "Automation experience"],
        locations: [{ name: "Remote" }],
        salaryMin: 90000,
        salaryMax: 120000,
        salaryCurrency: "USD",
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4()

      });

      // Submit application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: "counselor_assisted",
        coverLetter: "Test cover letter",
        customAnswers: { automationTools: ["Selenium", "Cypress"] },

      };

      const submitResult = await jobApplicationService.submitApplication(dto);
      testApplicationId = submitResult.data.id;

      // Update status
      await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "rejected",
        changedBy: uuidv4(),
        changeReason: "Not a good fit",
      });

      // Verify event was emitted
      expect(eventSpy).toHaveBeenCalledWith(
        "placement.application.status_changed",
        expect.any(Object)
      );
    }, 25000);
  });
});
