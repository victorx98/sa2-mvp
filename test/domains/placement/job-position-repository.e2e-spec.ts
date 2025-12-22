import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

// Domain modules
import { DrizzleJobPositionRepository } from '@domains/placement/job-position/infrastructure/repositories/drizzle-job-position.repository';
import { JobPositionMapper } from '@domains/placement/job-position/infrastructure/mappers/job-position.mapper';
import { JobPosition } from '@domains/placement/job-position/entities/job-position.entity';
import { H1BStatus } from '@domains/placement/types';

/**
 * Integration Test: JobPosition Repository
 * [JobPosition仓储集成测试]
 *
 * Tests all repository methods with actual database operations
 * [测试所有仓储方法与真实数据库操作的集成]
 */
describe('JobPosition Repository Integration Test [JobPosition仓储集成测试]', () => {
  let module: TestingModule;
  let repository: DrizzleJobPositionRepository;
  let db: NodePgDatabase<typeof schema>;

  // Test data
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
      providers: [JobPositionMapper, DrizzleJobPositionRepository],
    }).compile();

    repository = module.get<DrizzleJobPositionRepository>(DrizzleJobPositionRepository);
    db = module.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
  }, 30000);

  beforeEach(async () => {
    // Clean up any existing test data
    if (testJobIds.length > 0) {
      for (const jobId of testJobIds) {
        await db.delete(schema.recommendedJobs).where(eq(schema.recommendedJobs.jobId, jobId));
      }
      testJobIds.length = 0;
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testJobIds.length > 0) {
      for (const jobId of testJobIds) {
        await db.delete(schema.recommendedJobs).where(eq(schema.recommendedJobs.jobId, jobId));
      }
    }
    await module.close();
  });

  describe('Repository CRUD Operations [仓储CRUD操作]', () => {
    it('should save and retrieve a job position [应该保存并检索岗位]', async () => {
      console.log('\n=== Testing JobPosition Repository CRUD Operations ===\n');

      // Step 1: Create a job position
      console.log('📝 Step 1: Create job position');
      const jobPosition = JobPosition.create(
        'Senior Software Engineer',
        'Google',
        'test-user-123',
        {
          jobId: 'test-job-123',
          experienceRequirement: {
            minYears: 5,
            requiredSkills: ['JavaScript', 'TypeScript'],
          },
          salaryDetails: {
            minSalary: 150000,
            maxSalary: 200000,
            currency: 'USD',
            period: 'yearly',
            type: 'base',
          },
          jobLocations: [{ city: 'Mountain View', state: 'CA', country: 'US' }],
          countryCode: 'US',
          jobTypes: ['Full-time'],
          aiAnalysis: {
            skills: ['JavaScript', 'TypeScript'],
            summary: 'Tech Software position',
          },
          h1bStatus: H1BStatus.YES,
          jobApplicationTypes: ['direct'],
        },
      );
      testJobIds.push('test-job-123');

      // Step 2: Save the job position
      console.log('💾 Step 2: Save job position');
      const savedJob = await repository.save(jobPosition);
      console.log('✅ Saved job ID:', savedJob.getId());

      // Step 3: Retrieve the job position by ID
      console.log('🔍 Step 3: Retrieve job position by ID');
      const retrievedJob = await repository.findById(savedJob.getId());
      console.log('✅ Retrieved job:', retrievedJob?.getTitle());

      // Step 4: Verify the retrieved job matches the saved job
      expect(retrievedJob).not.toBeNull();
      expect(retrievedJob?.getId()).toBe(savedJob.getId());
      expect(retrievedJob?.getJobId()).toBe('test-job-123');
      expect(retrievedJob?.getTitle()).toBe('Senior Software Engineer');
      expect(retrievedJob?.getCompanyName()).toBe('Google');
      expect(retrievedJob?.getStatus().getValue()).toBe('active');
      expect(retrievedJob?.getH1BStatus()?.getValue()).toBe(H1BStatus.YES);
    });

    it('should update a job position [应该更新岗位]', async () => {
      console.log('\n📝 Testing job position update');

      // Create and save a job position
      const jobPosition = JobPosition.create(
        'Junior Developer',
        'Startup Co',
        'test-user-456',
        {
          jobId: 'test-job-456',
          jobTypes: ['Full-time'],
        },
      );
      testJobIds.push('test-job-456');

      const savedJob = await repository.save(jobPosition);
      const jobId = savedJob.getId();

      // Update the job position
      console.log('🔄 Step: Update job position status to INACTIVE');
      // Note: We need to use update method or the entity's update method
      // Since the entity doesn't have an update method, we'll update via repository
      const jobToUpdate = await repository.findById(jobId);
      if (jobToUpdate) {
        // For simplicity, we'll test update by changing the job via direct modification
        // In real scenarios, we would have proper update methods on the entity
        const updatedJob = await repository.update(jobToUpdate);
        console.log('✅ Updated job ID:', updatedJob.getId());
      }

      // Retrieve and verify
      const retrievedJob = await repository.findById(jobId);
      expect(retrievedJob).not.toBeNull();
      expect(retrievedJob?.getId()).toBe(jobId);
    });

    it('should find job positions by company name [应该通过公司名称查找岗位]', async () => {
      console.log('\n🔍 Testing find by company name');

      // Create multiple job positions
      const companies = ['Microsoft', 'Microsoft', 'Amazon'];

      for (let i = 0; i < companies.length; i++) {
        const job = JobPosition.create(
          `Engineer ${i}`,
          companies[i],
          'test-user',
          {
            jobId: `test-company-job-${i}`,
            jobTypes: ['Full-time'],
          },
        );
        testJobIds.push(`test-company-job-${i}`);
        await repository.save(job);
      }

      // Find by company name
      const microsoftJobs = await repository.findByCompanyName('Microsoft');
      console.log(`✅ Found ${microsoftJobs.length} Microsoft jobs`);

      expect(microsoftJobs.length).toBeGreaterThanOrEqual(2);
      microsoftJobs.forEach((job) => {
        expect(job.getCompanyName().toLowerCase()).toContain('microsoft');
      });
    });

    it('should search job positions with filters [应该使用过滤器搜索岗位]', async () => {
      console.log('\n🔍 Testing job position search with filters');

      // Create test jobs with different attributes
      const testJobs = [
        {
          title: 'Frontend Engineer',
          companyName: 'Tech Corp',
          countryCode: 'US',
          h1bStatus: H1BStatus.YES,
          jobTypes: ['Full-time'],
          jobLevel: 'entry_level',
        },
        {
          title: 'Backend Engineer',
          companyName: 'Tech Corp',
          countryCode: 'CA',
          h1bStatus: H1BStatus.NO,
          jobTypes: ['Full-time'],
          jobLevel: 'senior_level',
        },
        {
          title: 'Full Stack Developer',
          companyName: 'StartupXYZ',
          countryCode: 'US',
          h1bStatus: H1BStatus.YES,
          jobTypes: ['Full-time'],
          jobLevel: 'mid_level',
        },
      ];

      for (let i = 0; i < testJobs.length; i++) {
        const jobData = testJobs[i];
        const job = JobPosition.create(
          jobData.title,
          jobData.companyName,
          'test-user',
          {
            ...jobData,
            jobId: `test-search-${i + 1}`,
          },
        );
        testJobIds.push(`test-search-${i + 1}`);
        await repository.save(job);
      }

      // Test 1: Search by status
      console.log('✅ Test 1: Search by active status');
      const activeJobs = await repository.search({ status: 'active', page: 1, pageSize: 10 });
      expect(activeJobs.data.length).toBeGreaterThanOrEqual(2);
      activeJobs.data.forEach((job) => {
        expect(job.getStatus().getValue()).toBe('active');
      });

      // Test 2: Search by company name contains
      console.log('✅ Test 2: Search by company name contains "Tech"');
      const techJobs = await repository.search({ companyNameContains: 'Tech', page: 1, pageSize: 10 });
      expect(techJobs.data.length).toBeGreaterThanOrEqual(2);
      techJobs.data.forEach((job) => {
        expect(job.getCompanyName().toLowerCase()).toContain('tech');
      });

      // Test 3: Search by title contains
      console.log('✅ Test 3: Search by title contains "Engineer"');
      const engineerJobs = await repository.search({ titleContains: 'Engineer', page: 1, pageSize: 10 });
      expect(engineerJobs.data.length).toBeGreaterThanOrEqual(2);

      // Test 4: Search by country code
      console.log('✅ Test 4: Search by country code "US"');
      const usJobs = await repository.search({ countryCode: 'US', page: 1, pageSize: 10 });
      usJobs.data.forEach((job) => {
        expect(job.getCountryCode()).toBe('US');
      });

      // Test 5: Search by H1B status
      console.log('✅ Test 5: Search by H1B status "yes"');
      const h1bJobs = await repository.search({ h1bStatus: H1BStatus.YES, page: 1, pageSize: 10 });
      h1bJobs.data.forEach((job) => {
        expect(job.getH1BStatus()?.getValue()).toBe(H1BStatus.YES);
      });

      // Test 6: Combined filters
      console.log('✅ Test 6: Combined filters (US + active)');
      const combinedJobs = await repository.search({
        countryCode: 'US',
        status: 'active',
        page: 1,
        pageSize: 10,
      });
      combinedJobs.data.forEach((job) => {
        expect(job.getCountryCode()).toBe('US');
        expect(job.getStatus().getValue()).toBe('active');
      });

      // Test 7: Pagination
      console.log('✅ Test 7: Pagination (page 1, pageSize 2)');
      const paginatedJobs = await repository.search({ page: 1, pageSize: 2 });
      expect(paginatedJobs.data.length).toBeLessThanOrEqual(2);
      expect(paginatedJobs.page).toBe(1);
      expect(paginatedJobs.pageSize).toBe(2);
      expect(paginatedJobs.total).toBeGreaterThanOrEqual(3);
      expect(paginatedJobs.totalPages).toBeGreaterThanOrEqual(2);

      console.log('\n✅ All search tests passed!');
    });

    it('should find job position by job ID [应该通过job ID查找岗位]', async () => {
      console.log('\n🔍 Testing find by job ID');

      const jobId = 'test-job-id-unique-123';
      const job = JobPosition.create(
        'Data Scientist',
        'Data Corp',
        'test-user',
        {
          jobId,
          jobTypes: ['Full-time'],
        },
      );
      testJobIds.push(jobId);

      await repository.save(job);

      const foundJob = await repository.findByJobId(jobId);
      expect(foundJob).not.toBeNull();
      expect(foundJob?.getJobId()).toBe(jobId);
      expect(foundJob?.getTitle()).toBe('Data Scientist');
    });

    it('should find job position by object ID [应该通过对象ID查找岗位]', async () => {
      console.log('\n🔍 Testing find by object ID');

      const objectId = 'unique-object-id-456';
      const job = JobPosition.create(
        'Product Manager',
        'Product Co',
        'test-user',
        {
          jobId: 'test-object-id-job',
          objectId,
          jobTypes: ['Full-time'],
        },
      );
      testJobIds.push('test-object-id-job');

      await repository.save(job);

      const foundJob = await repository.findByObjectId(objectId);
      expect(foundJob).not.toBeNull();
      expect(foundJob?.getObjectId()).toBe(objectId);
    });
  });

  describe('Transaction Support [事务支持]', () => {
    it('should execute operations within a transaction [应该在事务中执行操作]', async () => {
      console.log('\n💾 Testing transaction support');

      const jobId1 = 'test-transaction-1';
      const jobId2 = 'test-transaction-2';
      testJobIds.push(jobId1, jobId2);

      // Create two job positions within a transaction
      await repository.withTransaction(async (txRepo) => {
        const job1 = JobPosition.create(
          'Transaction Job 1',
          'Transaction Corp',
          'test-user',
          {
            jobId: jobId1,
            jobTypes: ['Full-time'],
          },
        );

        const job2 = JobPosition.create(
          'Transaction Job 2',
          'Transaction Corp',
          'test-user',
          {
            jobId: jobId2,
            jobTypes: ['Full-time'],
          },
        );

        await txRepo.save(job1);
        await txRepo.save(job2);
      });

      // Verify both jobs were saved
      const foundJob1 = await repository.findByJobId(jobId1);
      const foundJob2 = await repository.findByJobId(jobId2);

      expect(foundJob1).not.toBeNull();
      expect(foundJob2).not.toBeNull();
      expect(foundJob1?.getTitle()).toBe('Transaction Job 1');
      expect(foundJob2?.getTitle()).toBe('Transaction Job 2');

      console.log('✅ Transaction completed successfully');
    });
  });
});
