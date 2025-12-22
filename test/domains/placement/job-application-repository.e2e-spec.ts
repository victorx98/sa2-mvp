import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

// Domain modules
import { DrizzleJobApplicationRepository } from '@domains/placement/job-application/infrastructure/repositories/drizzle-job-application.repository';
import { JobApplicationMapper } from '@domains/placement/job-application/infrastructure/mappers/job-application.mapper';
import { JobApplication } from '@domains/placement/job-application/entities/job-application.entity';
import { ApplicationType } from '@domains/placement/types';
import { DrizzleJobPositionRepository } from '@domains/placement/job-position/infrastructure/repositories/drizzle-job-position.repository';
import { JobPositionMapper } from '@domains/placement/job-position/infrastructure/mappers/job-position.mapper';
import { JobPosition } from '@domains/placement/job-position/entities/job-position.entity';

/**
 * Integration Test: JobApplication Repository
 * [JobApplication仓储集成测试]
 *
 * Tests all repository methods with actual database operations
 * [测试所有仓储方法与真实数据库操作的集成]
 */
describe('JobApplication Repository Integration Test [JobApplication仓储集成测试]', () => {
  let module: TestingModule;
  let repository: DrizzleJobApplicationRepository;
  let jobPositionRepository: DrizzleJobPositionRepository;
  let db: NodePgDatabase<typeof schema>;

  // Test data
  const testApplicationIds: string[] = [];
  const testJobIds: string[] = [];

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        DatabaseModule,
      ],
      providers: [
        JobApplicationMapper,
        DrizzleJobApplicationRepository,
        JobPositionMapper,
        DrizzleJobPositionRepository,
      ],
    }).compile();

    repository = module.get<DrizzleJobApplicationRepository>(DrizzleJobApplicationRepository);
    jobPositionRepository = module.get<DrizzleJobPositionRepository>(DrizzleJobPositionRepository);
    db = module.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
  }, 30000);

  beforeEach(async () => {
    // Clean up any existing test data
    if (testApplicationIds.length > 0) {
      for (const appId of testApplicationIds) {
        await db.delete(schema.jobApplications).where(eq(schema.jobApplications.id, appId));
      }
      testApplicationIds.length = 0;
    }

    if (testJobIds.length > 0) {
      for (const jobId of testJobIds) {
        await db.delete(schema.recommendedJobs).where(eq(schema.recommendedJobs.jobId, jobId));
      }
      testJobIds.length = 0;
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testApplicationIds.length > 0) {
      for (const appId of testApplicationIds) {
        await db.delete(schema.jobApplications).where(eq(schema.jobApplications.id, appId));
      }
    }

    if (testJobIds.length > 0) {
      for (const jobId of testJobIds) {
        await db.delete(schema.recommendedJobs).where(eq(schema.recommendedJobs.jobId, jobId));
      }
    }

    await module.close();
  });

  describe('Repository CRUD Operations [仓储CRUD操作]', () => {
    it('should save and retrieve a job application [应该保存并检索投递申请]', async () => {
      console.log('\n=== Testing JobApplication Repository CRUD Operations ===\n');

      // Step 1: Create a job position first
      console.log('📝 Step 1: Create job position');
      const jobPosition = JobPosition.create(
        'Software Engineer',
        'Google',
        'test-user-123',
        {
          jobId: 'test-job-app-123',
          jobTypes: ['Full-time'],
        },
      );
      testJobIds.push('test-job-app-123');
      await jobPositionRepository.save(jobPosition);
      const jobId = jobPosition.getId();

      // Step 2: Create a job application
      console.log('📝 Step 2: Create job application');
      const jobApplication = JobApplication.create(
        'test-student-123',
        jobId,
        ApplicationType.DIRECT,
        {
          coverLetter: 'I am very interested in this position.',
          notes: 'This is a test application.',
        },
      );
      testApplicationIds.push(jobApplication.getId());

      // Step 3: Save the job application
      console.log('💾 Step 3: Save job application');
      const savedApplication = await repository.save(jobApplication);
      console.log('✅ Saved application ID:', savedApplication.getId());

      // Step 4: Retrieve the job application by ID
      console.log('🔍 Step 4: Retrieve job application by ID');
      const retrievedApplication = await repository.findById(savedApplication.getId());
      console.log('✅ Retrieved application:', retrievedApplication?.getId());

      // Step 5: Verify the retrieved application matches the saved application
      expect(retrievedApplication).not.toBeNull();
      expect(retrievedApplication?.getId()).toBe(savedApplication.getId());
      expect(retrievedApplication?.getStudentId()).toBe('test-student-123');
      expect(retrievedApplication?.getJobId()).toBe(jobId);
      expect(retrievedApplication?.getApplicationType().getValue()).toBe(ApplicationType.DIRECT);
      expect(retrievedApplication?.getStatus().getValue()).toBe('submitted');
      expect(retrievedApplication?.getCoverLetter()).toBe('I am very interested in this position.');
      expect(retrievedApplication?.getNotes()).toBe('This is a test application.');
    });

    it('should check if student has already applied to a job [应该检查学生是否已申请过岗位]', async () => {
      console.log('\n📝 Testing duplicate application check');

      // Create job position
      const jobPosition = JobPosition.create(
        'Designer',
        'Design Co',
        'test-user-123',
        {
          jobId: 'test-dup-job-123',
          jobTypes: ['Full-time'],
        },
      );
      testJobIds.push('test-dup-job-123');
      await jobPositionRepository.save(jobPosition);
      const jobId = jobPosition.getId();

      const studentId = 'test-student-dup-123';

      // Initially, no application should exist
      console.log('🔍 Step 1: Check if application exists (should be false)');
      const existsBefore = await repository.existsByStudentAndJob(studentId, jobId);
      expect(existsBefore).toBe(false);
      console.log('✅ Application does not exist (as expected)');

      // Create and save an application
      console.log('💾 Step 2: Create and save application');
      const application = JobApplication.create(studentId, jobId, ApplicationType.DIRECT);
      testApplicationIds.push(application.getId());
      await repository.save(application);
      console.log('✅ Application saved');

      // Now, application should exist
      console.log('🔍 Step 3: Check if application exists (should be true)');
      const existsAfter = await repository.existsByStudentAndJob(studentId, jobId);
      expect(existsAfter).toBe(true);
      console.log('✅ Application exists (as expected)');
    });

    it('should find job applications by student ID [应该通过学生ID查找投递申请]', async () => {
      console.log('\n🔍 Testing find by student ID');

      // Create job positions
      const job1 = JobPosition.create(
        'Job 1',
        'Company 1',
        'test-user-123',
        {
          jobId: 'test-student-job-1',
          jobTypes: ['Full-time'],
        },
      );
      const job2 = JobPosition.create(
        'Job 2',
        'Company 2',
        'test-user-123',
        {
          jobId: 'test-student-job-2',
          jobTypes: ['Full-time'],
        },
      );

      testJobIds.push('test-student-job-1', 'test-student-job-2');
      await jobPositionRepository.save(job1);
      await jobPositionRepository.save(job2);

      const studentId = 'test-student-multi';

      // Create multiple applications for the same student
      const application1 = JobApplication.create(studentId, job1.getId(), ApplicationType.DIRECT);
      const application2 = JobApplication.create(studentId, job2.getId(), ApplicationType.REFERRAL, {
        assignedMentorId: 'test-mentor-123',
      });

      testApplicationIds.push(application1.getId(), application2.getId());
      await repository.save(application1);
      await repository.save(application2);

      // Find applications by student ID
      const applications = await repository.findByStudentId(studentId);
      console.log(`✅ Found ${applications.length} applications for student ${studentId}`);

      expect(applications.length).toBe(2);
      applications.forEach((app) => {
        expect(app.getStudentId()).toBe(studentId);
      });
    });

    it('should search job applications with filters [应该使用过滤器搜索投递申请]', async () => {
      console.log('\n🔍 Testing job application search with filters');

      // Create job positions
      const job1 = JobPosition.create(
        'Engineer Position',
        'Tech Corp',
        'test-user-123',
        {
          jobId: 'test-search-app-job-1',
          jobTypes: ['Full-time'],
        },
      );
      const job2 = JobPosition.create(
        'Designer Position',
        'Design Corp',
        'test-user-123',
        {
          jobId: 'test-search-app-job-2',
          jobTypes: ['Full-time'],
        },
      );

      testJobIds.push('test-search-app-job-1', 'test-search-app-job-2');
      await jobPositionRepository.save(job1);
      await jobPositionRepository.save(job2);

      const studentId = 'test-student-search';
      const mentorId = 'test-mentor-search';

      // Create test applications with different attributes
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const app1 = JobApplication.create(studentId, job1.getId(), ApplicationType.DIRECT);
      const app2 = JobApplication.create(studentId, job2.getId(), ApplicationType.REFERRAL, {
        assignedMentorId: mentorId,
      });
      testApplicationIds.push(app1.getId(), app2.getId());
      await repository.save(app1);
      await repository.save(app2);

      // Test 1: Search by student ID
      console.log('✅ Test 1: Search by student ID');
      const studentApps = await repository.search({ studentId, page: 1, pageSize: 10 });
      expect(studentApps.data.length).toBeGreaterThanOrEqual(2);
      studentApps.data.forEach((app) => {
        expect(app.getStudentId()).toBe(studentId);
      });

      // Test 2: Search by application type
      console.log('✅ Test 2: Search by application type (REFERRAL)');
      const referralApps = await repository.search({
        applicationType: ApplicationType.REFERRAL,
        page: 1,
        pageSize: 10,
      });
      referralApps.data.forEach((app) => {
        expect(app.getApplicationType().getValue()).toBe(ApplicationType.REFERRAL);
      });

      // Test 3: Search by assigned mentor
      console.log('✅ Test 3: Search by assigned mentor ID');
      const mentorApps = await repository.search({ assignedMentorId: mentorId, page: 1, pageSize: 10 });
      mentorApps.data.forEach((app) => {
        expect(app.getAssignedMentorId()).toBe(mentorId);
      });

      // Test 4: Search by status
      console.log('✅ Test 4: Search by status (submitted)');
      const submittedApps = await repository.search({ status: 'submitted', page: 1, pageSize: 10 });
      submittedApps.data.forEach((app) => {
        expect(app.getStatus().getValue()).toBe('submitted');
      });

      // Test 5: Combined filters
      console.log('✅ Test 5: Combined filters (studentId + status)');
      const combinedApps = await repository.search({
        studentId,
        status: 'submitted',
        page: 1,
        pageSize: 10,
      });
      combinedApps.data.forEach((app) => {
        expect(app.getStudentId()).toBe(studentId);
        expect(app.getStatus().getValue()).toBe('submitted');
      });

      // Test 6: Date range filter
      console.log('✅ Test 6: Date range filter (submitted after yesterday)');
      const dateRangeApps = await repository.search({
        submittedAfter: yesterday,
        page: 1,
        pageSize: 10,
      });
      dateRangeApps.data.forEach((app) => {
        expect(app.getSubmittedAt().getTime()).toBeGreaterThanOrEqual(yesterday.getTime());
      });

      // Test 7: Pagination
      console.log('✅ Test 7: Pagination (page 1, pageSize 1)');
      const paginatedApps = await repository.search({ page: 1, pageSize: 1 });
      expect(paginatedApps.data.length).toBeLessThanOrEqual(1);
      expect(paginatedApps.page).toBe(1);
      expect(paginatedApps.pageSize).toBe(1);
      expect(paginatedApps.total).toBeGreaterThanOrEqual(2);

      console.log('\n✅ All search tests passed!');
    });

    it('should find job applications by job ID [应该通过岗位ID查找投递申请]', async () => {
      console.log('\n🔍 Testing find by job ID');

      const job = JobPosition.create(
        'QA Engineer',
        'QA Corp',
        'test-user-123',
        {
          jobId: 'test-find-app-by-job-123',
          jobTypes: ['Full-time'],
        },
      );
      testJobIds.push('test-find-app-by-job-123');
      await jobPositionRepository.save(job);
      const jobId = job.getId();

      // Create multiple applications for the same job
      const app1 = JobApplication.create('student-1', jobId, ApplicationType.DIRECT);
      const app2 = JobApplication.create('student-2', jobId, ApplicationType.DIRECT);
      testApplicationIds.push(app1.getId(), app2.getId());
      await repository.save(app1);
      await repository.save(app2);

      // Find applications by job ID
      const applications = await repository.findByJobId(jobId);
      console.log(`✅ Found ${applications.length} applications for job ${jobId}`);

      expect(applications.length).toBe(2);
      applications.forEach((app) => {
        expect(app.getJobId()).toBe(jobId);
      });
    });

    it('should find job application by student and job ID [应该通过学生和岗位ID查找投递申请]', async () => {
      console.log('\n🔍 Testing find by student and job ID');

      const job = JobPosition.create(
        'DevOps Engineer',
        'DevOps Corp',
        'test-user-123',
        {
          jobId: 'test-find-specific-app-123',
          jobTypes: ['Full-time'],
        },
      );
      testJobIds.push('test-find-specific-app-123');
      await jobPositionRepository.save(job);
      const jobId = job.getId();

      const studentId = 'test-specific-student';
      const application = JobApplication.create(studentId, jobId, ApplicationType.DIRECT);
      testApplicationIds.push(application.getId());
      await repository.save(application);

      // Find by student and job ID
      const foundApp = await repository.findByStudentAndJob(studentId, jobId);
      expect(foundApp).not.toBeNull();
      expect(foundApp?.getStudentId()).toBe(studentId);
      expect(foundApp?.getJobId()).toBe(jobId);
    });

    it('should handle referral applications with mentor assignment [应该处理带导师分配的内推申请]', async () => {
      console.log('\n🔍 Testing referral applications with mentor');

      const job = JobPosition.create(
        'Senior Developer',
        'Senior Corp',
        'test-user-123',
        {
          jobId: 'test-referral-app-123',
          jobTypes: ['Full-time'],
        },
      );
      testJobIds.push('test-referral-app-123');
      await jobPositionRepository.save(job);
      const jobId = job.getId();

      const studentId = 'test-referral-student';
      const mentorId = 'test-referral-mentor';

      // Create referral application with mentor
      const referralApp = JobApplication.create(studentId, jobId, ApplicationType.REFERRAL, {
        assignedMentorId: mentorId,
      });
      testApplicationIds.push(referralApp.getId());
      await repository.save(referralApp);

      // Verify mentor is assigned
      const foundApp = await repository.findById(referralApp.getId());
      expect(foundApp).not.toBeNull();
      expect(foundApp?.getApplicationType().getValue()).toBe(ApplicationType.REFERRAL);
      expect(foundApp?.getAssignedMentorId()).toBe(mentorId);
      expect(foundApp?.requiresMentorAssignment()).toBe(true);

      console.log('✅ Referral application with mentor created successfully');
    });
  });

  describe('Transaction Support [事务支持]', () => {
    it('should execute operations within a transaction [应该在事务中执行操作]', async () => {
      console.log('\n💾 Testing transaction support');

      const job = JobPosition.create(
        'Transaction Test Job',
        'Transaction Corp',
        'test-user-123',
        {
          jobId: 'test-transaction-app-job',
          jobTypes: ['Full-time'],
        },
      );
      testJobIds.push('test-transaction-app-job');
      await jobPositionRepository.save(job);
      const jobId = job.getId();

      const studentId = 'test-transaction-student';

      // Create job applications within a transaction
      await repository.withTransaction(async (txRepo) => {
        const app1 = JobApplication.create(studentId, jobId, ApplicationType.DIRECT);
        const app2 = JobApplication.create(studentId, jobId, ApplicationType.PROXY);

        await txRepo.save(app1);
        await txRepo.save(app2);

        testApplicationIds.push(app1.getId(), app2.getId());
      });

      // Verify both applications were saved
      const applications = await repository.findByStudentId(studentId);
      expect(applications.length).toBe(2);

      console.log('✅ Transaction completed successfully');
    });
  });
});
