import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { FinancialModule } from '@domains/financial/financial.module';
import { DATABASE_CONNECTION } from '@infrastructure/database/database.provider';
import * as schema from '@infrastructure/database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleMentorPayableLedgerRepository } from '@domains/financial/infrastructure/repositories/drizzle-mentor-payable-ledger.repository';

/**
 * Simple Integration Test: MentorPayableLedger Repository
 * [MentorPayableLedger仓储简单集成测试]
 */
describe('Simple MentorPayableLedger Integration Test', () => {
  let module: TestingModule;
  let repository: DrizzleMentorPayableLedgerRepository;
  let db: NodePgDatabase<typeof schema>;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env',
        }),
        FinancialModule,
      ],
    }).compile();

    repository = module.get<DrizzleMentorPayableLedgerRepository>(DrizzleMentorPayableLedgerRepository);
    db = module.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
  }, 30000);

  afterAll(async () => {
    await module.close();
  });

  it('should compile and load the repository', () => {
    expect(repository).toBeDefined();
    expect(db).toBeDefined();
  });
});
