import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '@infrastructure/database/database.module';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

// Domain modules
import { DrizzleMentorPayableLedgerRepository } from '@domains/financial/infrastructure/repositories/drizzle-mentor-payable-ledger.repository';
import { MentorPayableLedgerMapper } from '@domains/financial/infrastructure/mappers/mentor-payable-ledger.mapper';
import { MentorPayableLedger } from '@domains/financial/entities/mentor-payable-ledger.entity';
import { Money } from '@domains/financial/value-objects/money.vo';

/**
 * Integration Test: MentorPayableLedger Repository
 * [MentorPayableLedger仓储集成测试]
 *
 * Tests all repository methods with actual database operations
 * [测试所有仓储方法与真实数据库操作的集成]
 */
describe('MentorPayableLedger Repository Integration Test [MentorPayableLedger仓储集成测试]', () => {
  let module: TestingModule;
  let repository: DrizzleMentorPayableLedgerRepository;
  let db: NodePgDatabase<typeof schema>;

  // Test data
  const testLedgerIds: string[] = [];

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        DatabaseModule,
      ],
      providers: [MentorPayableLedgerMapper, DrizzleMentorPayableLedgerRepository],
    }).compile();

    repository = module.get<DrizzleMentorPayableLedgerRepository>(DrizzleMentorPayableLedgerRepository);
    db = module.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
  }, 30000);

  beforeEach(async () => {
    // Clean up any existing test data
    if (testLedgerIds.length > 0) {
      for (const ledgerId of testLedgerIds) {
        await db.delete(schema.mentorPayableLedgers).where(eq(schema.mentorPayableLedgers.id, ledgerId));
      }
      testLedgerIds.length = 0;
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testLedgerIds.length > 0) {
      for (const ledgerId of testLedgerIds) {
        await db.delete(schema.mentorPayableLedgers).where(eq(schema.mentorPayableLedgers.id, ledgerId));
      }
    }
    await module.close();
  });

  describe('Repository CRUD Operations [仓储CRUD操作]', () => {
    it('should save and retrieve a mentor payable ledger [应该保存并检索导师应付账款]', async () => {
      console.log('\n=== Testing MentorPayableLedger Repository CRUD Operations ===\n');

      // Step 1: Create a mentor payable ledger
      console.log('📝 Step 1: Create mentor payable ledger');
      const ledger = MentorPayableLedger.create(
        'test-reference-123',
        'test-mentor-456',
        'resume_review',
        Money.create(100, 'USD'),
        Money.create(100, 'USD'),
        {
          studentId: 'test-student-789',
          createdBy: 'test-user-001',
        },
      );
      testLedgerIds.push(ledger.getId());

      // Step 2: Save the ledger
      console.log('💾 Step 2: Save ledger');
      const savedLedger = await repository.save(ledger);
      console.log('✅ Saved ledger ID:', savedLedger.getId());

      // Step 3: Retrieve the ledger by ID
      console.log('🔍 Step 3: Retrieve ledger by ID');
      const retrievedLedger = await repository.findById(savedLedger.getId());
      console.log('✅ Retrieved ledger:', retrievedLedger?.getId());

      // Step 4: Verify the retrieved ledger matches the saved ledger
      expect(retrievedLedger).not.toBeNull();
      expect(retrievedLedger?.getId()).toBe(savedLedger.getId());
      expect(retrievedLedger?.getReferenceId()).toBe('test-reference-123');
      expect(retrievedLedger?.getMentorId()).toBe('test-mentor-456');
      expect(retrievedLedger?.getSessionTypeCode()).toBe('resume_review');
      expect(retrievedLedger?.getPrice().getAmount()).toBe(100);
      expect(retrievedLedger?.getAmount().getAmount()).toBe(100);
      expect(retrievedLedger?.getAmount().getCurrency()).toBe('USD');
      expect(retrievedLedger?.getStudentId()).toBe('test-student-789');
      expect(retrievedLedger?.isSettled()).toBe(false);
    });

    it('should find ledgers by mentor ID [应该通过导师ID查找账款]', async () => {
      console.log('\n📝 Testing find by mentor ID');

      const mentorId = 'test-mentor-multi';

      // Create multiple ledgers for the same mentor
      const ledger1 = MentorPayableLedger.create(
        'test-ref-1',
        mentorId,
        'resume_review',
        Money.create(100, 'USD'),
        Money.create(100, 'USD'),
      );
      const ledger2 = MentorPayableLedger.create(
        'test-ref-2',
        mentorId,
        'session',
        Money.create(200, 'USD'),
        Money.create(200, 'USD'),
      );

      testLedgerIds.push(ledger1.getId(), ledger2.getId());
      await repository.save(ledger1);
      await repository.save(ledger2);

      // Find by mentor ID
      const ledgers = await repository.findByMentorId(mentorId);
      console.log(`✅ Found ${ledgers.length} ledgers for mentor ${mentorId}`);

      expect(ledgers.length).toBe(2);
      ledgers.forEach((ledger) => {
        expect(ledger.getMentorId()).toBe(mentorId);
      });
    });

    it('should find unsettled ledgers for a mentor [应该查找导师的未结算账款]', async () => {
      console.log('\n📝 Testing find unsettled ledgers');

      const mentorId = 'test-mentor-unsettled';

      const unsettledLedger = MentorPayableLedger.create(
        'test-ref-unsettled',
        mentorId,
        'resume_review',
        Money.create(150, 'USD'),
        Money.create(150, 'USD'),
      );

      testLedgerIds.push(unsettledLedger.getId());
      await repository.save(unsettledLedger);

      const unsettledLedgers = await repository.findUnsettledByMentorId(mentorId);
      console.log(`✅ Found ${unsettledLedgers.length} unsettled ledgers`);

      expect(unsettledLedgers.length).toBeGreaterThanOrEqual(1);
      unsettledLedgers.forEach((ledger) => {
        expect(ledger.getMentorId()).toBe(mentorId);
        expect(ledger.isSettled()).toBe(false);
      });
    });

    it('should get total unsettled amount for a mentor [应该获取导师的未结算总额]', async () => {
      console.log('\n📝 Testing get total unsettled amount');

      const mentorId = 'test-mentor-total';

      const ledger1 = MentorPayableLedger.create(
        'test-ref-total-1',
        mentorId,
        'resume_review',
        Money.create(100, 'USD'),
        Money.create(100, 'USD'),
      );
      const ledger2 = MentorPayableLedger.create(
        'test-ref-total-2',
        mentorId,
        'session',
        Money.create(200, 'USD'),
        Money.create(200, 'USD'),
      );

      testLedgerIds.push(ledger1.getId(), ledger2.getId());
      await repository.save(ledger1);
      await repository.save(ledger2);

      const totalAmount = await repository.getTotalUnsettledAmount(mentorId);
      console.log(`✅ Total unsettled amount: ${totalAmount}`);

      expect(totalAmount).toBeGreaterThanOrEqual(300);
    });

    it('should create adjustment entries [应该创建调整记录]', async () => {
      console.log('\n📝 Testing adjustment entries');

      // Create original ledger
      const originalLedger = MentorPayableLedger.create(
        'test-ref-adjustment',
        'test-mentor-adjust',
        'resume_review',
        Money.create(150, 'USD'),
        Money.create(150, 'USD'),
      );

      testLedgerIds.push(originalLedger.getId());
      const savedOriginal = await repository.save(originalLedger);

      // Create adjustment
      const adjustmentLedger = MentorPayableLedger.createAdjustment(
        savedOriginal,
        Money.create(-50, 'USD'),
        'Adjustment for discount',
        'test-user-001',
      );

      testLedgerIds.push(adjustmentLedger.getId());
      await repository.save(adjustmentLedger);

      // Verify adjustment
      expect(adjustmentLedger.isAdjustment()).toBe(true);
      expect(adjustmentLedger.getOriginalId()).toBe(savedOriginal.getId());
      expect(adjustmentLedger.getAdjustmentReason()).toBe('Adjustment for discount');

      console.log('✅ Adjustment created successfully');
    });

    it('should mark ledger as settled [应该标记为已结算]', async () => {
      console.log('\n📝 Testing settle ledger');

      const ledger = MentorPayableLedger.create(
        'test-ref-settle',
        'test-mentor-settle',
        'resume_review',
        Money.create(100, 'USD'),
        Money.create(100, 'USD'),
      );

      testLedgerIds.push(ledger.getId());
      const savedLedger = await repository.save(ledger);

      // Settle the ledger
      savedLedger.markAsSettled('settlement-123', 'test-user-001');
      const updatedLedger = await repository.update(savedLedger);

      // Verify settlement
      expect(updatedLedger.isSettled()).toBe(true);
      expect(updatedLedger.getSettlementId()).toBe('settlement-123');
      expect(updatedLedger.getSettledAt()).toBeDefined();

      console.log('✅ Ledger marked as settled');
    });
  });

  describe('Transaction Support [事务支持]', () => {
    it('should execute operations within a transaction [应该在事务中执行操作]', async () => {
      console.log('\n💾 Testing transaction support');

      const mentorId = 'test-mentor-transaction';

      await repository.withTransaction(async (txRepo) => {
        const ledger1 = MentorPayableLedger.create(
          'test-ref-tx-1',
          mentorId,
          'resume_review',
          Money.create(100, 'USD'),
          Money.create(100, 'USD'),
        );
        const ledger2 = MentorPayableLedger.create(
          'test-ref-tx-2',
          mentorId,
          'session',
          Money.create(200, 'USD'),
          Money.create(200, 'USD'),
        );

        testLedgerIds.push(ledger1.getId(), ledger2.getId());
        await txRepo.save(ledger1);
        await txRepo.save(ledger2);
      });

      // Verify both ledgers were saved
      const ledgers = await repository.findByMentorId(mentorId);
      expect(ledgers.length).toBe(2);

      console.log('✅ Transaction completed successfully');
    });
  });
});
