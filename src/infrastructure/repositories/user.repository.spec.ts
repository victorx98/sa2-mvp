import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { UserRepository } from "./user.repository";
import { DatabaseModule } from "@infrastructure/database/database.module";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import {
  createTestFixtures,
  TestFixtures,
} from "../../../test/utils/test-fixtures";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "@infrastructure/database/schema";

describe("UserRepository (Integration with Real Database)", () => {
  let moduleRef: TestingModule;
  let repository: UserRepository;
  let db: NodePgDatabase<typeof schema>;
  let fixtures: TestFixtures;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env",
        }),
        DatabaseModule,
      ],
      providers: [UserRepository],
    }).compile();

    repository = moduleRef.get<UserRepository>(UserRepository);
    db = moduleRef.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
    fixtures = createTestFixtures(db);
  });

  afterAll(async () => {
    // Clean up test data
    await db.delete(schema.userTable);
    await moduleRef.close();
  });

  describe("create", () => {
    it("should successfully create a user", async () => {
      const timestamp = Date.now();
      const userData = {
        email: `test-${timestamp}@example.com`,
        password: "hashedPassword123",
        username: `testuser-${timestamp}`,
        nickname: "Test User",
      };

      const result = await repository.create(userData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.email).toBe(userData.email);
      expect(result.nickname).toBe(userData.nickname);
    });
  });

  describe("findById", () => {
    it("should find user by ID", async () => {
      const user = await fixtures.createUser();

      const result = await repository.findById(user.id);

      expect(result).toBeDefined();
      expect(result?.id).toBe(user.id);
      expect(result?.email).toBe(user.email);
    });

    it("should return null when user not found", async () => {
      const result = await repository.findById(
        "00000000-0000-0000-0000-000000000000",
      );

      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should find user by email", async () => {
      const user = await fixtures.createUser();

      const result = await repository.findByEmail(user.email);

      expect(result).toBeDefined();
      expect(result?.id).toBe(user.id);
      expect(result?.email).toBe(user.email);
    });

    it("should return null when user not found", async () => {
      const result = await repository.findByEmail("nonexistent@example.com");

      expect(result).toBeNull();
    });
  });

  describe("findByEmailWithPassword", () => {
    it("should find user with password by email", async () => {
      const user = await fixtures.createUser();

      const result = await repository.findByEmailWithPassword(user.email);

      expect(result).toBeDefined();
      expect(result?.id).toBe(user.id);
      expect(result?.email).toBe(user.email);
      expect(result?.password).toBeDefined();
    });

    it("should return null when user not found", async () => {
      const result = await repository.findByEmailWithPassword(
        "nonexistent@example.com",
      );

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should successfully update user", async () => {
      const user = await fixtures.createUser();

      const updateData = {
        nickname: "Updated Nickname",
        cnNickname: "Updated CN Nickname",
      };

      const result = await repository.update(user.id, updateData);

      expect(result).toBeDefined();
      expect(result?.nickname).toBe(updateData.nickname);
      expect(result?.cnNickname).toBe(updateData.cnNickname);
    });

    it("should return null when updating non-existent user", async () => {
      const result = await repository.update(
        "00000000-0000-0000-0000-000000000000",
        {
          nickname: "Test",
        },
      );

      expect(result).toBeNull();
    });
  });

  // Note: UserRepository does not have delete method, removing test
});
