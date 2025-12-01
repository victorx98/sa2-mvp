import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { PlacementModule } from "@domains/placement/placement.module";
import { JobApplicationService } from "@domains/placement/services/job-application.service";
import { JobPositionService } from "@domains/placement/services/job-position.service";
import { ISubmitApplicationDto } from "@domains/placement/dto/job-application.dto";

import { sql } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { v4 as uuidv4 } from "uuid";
import { ApplicationType } from "@domains/placement/types/application-type.enum";

/**
 * Direct Application Flow E2E Tests
 * Comprehensive integration tests for direct job application process
 * [海投流程集成测试]
 */
describe("Direct Application Flow (e2e)", () => {
  let app: INestApplication;
  let jobApplicationService: JobApplicationService;
  let jobPositionService: JobPositionService;
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
        DatabaseModule,
        PlacementModule,
      ],
    }).compile();

    jobApplicationService = moduleFixture.get<JobApplicationService>(
      JobApplicationService,
    );
    jobPositionService =
      moduleFixture.get<JobPositionService>(JobPositionService);
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
    // Using Drizzle ORM's execute method with proper syntax
    // Only clean up if testApplicationId is defined
    if (testApplicationId) {
      try {
        await db.execute(
          sql`DELETE FROM application_history WHERE application_id = ${testApplicationId}`,
        );
        await db.execute(
          sql`DELETE FROM job_applications WHERE id = ${testApplicationId}`,
        );
      } catch (_error) {
        // Ignore if tables don't exist
      }
    }
    try {
      await db.execute(
        sql`DELETE FROM recommended_jobs WHERE id = ${testJobId}`,
      );
    } catch (_error) {
      // Ignore if table doesn't exist
    }
  });

  describe("Direct Application Submission", () => {
    it("should submit a direct job application successfully", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: { skills: ["Test requirement 1", "Test requirement 2"] },
        remoteType: "fully_remote",
        salaryMin: 100000,
        salaryMax: 150000,
        salaryCurrency: "USD",
        postedDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit direct application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.DIRECT,
        coverLetter: "Test cover letter for direct application",
        customAnswers: { question1: "answer1", question2: "answer2" },
      };

      const result = await jobApplicationService.submitApplication(dto);
      testApplicationId = result.data.id;

      // Verify application was created successfully
      expect(result.data).toBeDefined();
      expect(result.data.studentId).toBe(testStudentId);
      expect(result.data.jobId).toBe(jobResult.data.id);
      expect(result.data.applicationType).toBe("direct");
      expect(result.data.status).toBe("submitted");
    }, 30000); // 30s timeout for database operations

    it("should throw error if submitting duplicate application", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: { skills: ["Test requirement 1", "Test requirement 2"] },
        remoteType: "fully_remote",
        salaryMin: 100000,
        salaryMax: 150000,
        salaryCurrency: "USD",
        postedDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit first application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.DIRECT,
        coverLetter: "Test cover letter",
        customAnswers: { question1: "answer1" },
      };

      await jobApplicationService.submitApplication(dto);

      // Try to submit duplicate application
      await expect(
        jobApplicationService.submitApplication(dto),
      ).rejects.toThrow();
    }, 20000);

    it("should update application status correctly", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: { skills: ["Test requirement 1", "Test requirement 2"] },
        remoteType: "fully_remote",
        salaryMin: 100000,
        salaryMax: 150000,
        salaryCurrency: "USD",
        postedDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.DIRECT,
        coverLetter: "Test cover letter",
        customAnswers: { question1: "answer1" },
      };

      const submitResult = await jobApplicationService.submitApplication(dto);
      testApplicationId = submitResult.data.id;

      // Update status to interviewed
      const updateResult = await jobApplicationService.updateApplicationStatus({
        applicationId: testApplicationId,
        newStatus: "interviewed",
        changedBy: uuidv4(),
        changeReason: "Moving to interviewed",
      });

      expect(updateResult.data.status).toBe("interviewed");
    }, 25000);

    it("should retrieve application by ID", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: { skills: ["Test requirement 1", "Test requirement 2"] },
        remoteType: "fully_remote",
        salaryMin: 100000,
        salaryMax: 150000,
        salaryCurrency: "USD",
        postedDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.DIRECT,
        coverLetter: "Test cover letter",
        customAnswers: { question1: "answer1" },
      };

      const submitResult = await jobApplicationService.submitApplication(dto);
      testApplicationId = submitResult.data.id;

      // Retrieve application by ID
      const retrievedApplication = await jobApplicationService.findOne({
        id: testApplicationId,
      });

      expect(retrievedApplication).toBeDefined();
      expect(retrievedApplication.id).toBe(testApplicationId);
      expect(retrievedApplication.studentId).toBe(testStudentId);
    }, 20000);

    it("should throw error if application not found", async () => {
      // Try to retrieve non-existent application
      await expect(
        jobApplicationService.findOne({ id: uuidv4() }),
      ).rejects.toThrow();
    }, 10000);
  });

  describe("Application Status History", () => {
    it("should record status change history", async () => {
      // Create a test job position first
      const jobResult = await jobPositionService.createJobPosition({
        title: "Software Engineer",
        companyName: "Test Company",
        description: "Test job description",
        requirements: { skills: ["Test requirement 1", "Test requirement 2"] },
        remoteType: "fully_remote",
        salaryMin: 100000,
        salaryMax: 150000,
        salaryCurrency: "USD",
        postedDate: new Date(),
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        source: "test",
        jobSource: "bd",
        createdBy: uuidv4(),
      });

      // Submit application
      const dto: ISubmitApplicationDto = {
        studentId: testStudentId,
        jobId: jobResult.data.id,
        applicationType: ApplicationType.DIRECT,
        coverLetter: "Test cover letter",
        customAnswers: { question1: "answer1" },
      };

      const submitResult = await jobApplicationService.submitApplication(dto);
      testApplicationId = submitResult.data.id;

      // Update status multiple times
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
        changeReason: "Moving to got_offer",
      });

      // Get status history
      const history =
        await jobApplicationService.getStatusHistory(testApplicationId);

      expect(history).toBeDefined();
      expect(history.length).toBeGreaterThanOrEqual(2); // Should have at least 2 status changes
    }, 30000);
  });
});
