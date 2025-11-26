import { Test, TestingModule } from "@nestjs/testing";
import { UserService } from "./user-service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";

describe("UserService", () => {
  let service: UserService;

  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: DATABASE_CONNECTION,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should return user when found", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        nameEn: "Test User",
        nameZh: "测试用户",
        gender: "male",
        status: "active",
        country: "CN",
        password: "hashed-password",
        createdTime: new Date(),
        modifiedTime: new Date(),
      };

      const mockQuery = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUser]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await service.findById("user-1");

      expect(result).toBeDefined();
      expect(result?.id).toBe("user-1");
      expect(result?.email).toBe("test@example.com");
      expect(mockDb.select).toHaveBeenCalled();
      expect(mockQuery.where).toHaveBeenCalled();
      expect(mockQuery.limit).toHaveBeenCalledWith(1);
    });

    it("should return null when user not found", async () => {
      const mockQuery = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await service.findById("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should return user when found by email", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        nameEn: "Test User",
        nameZh: null,
        gender: null,
        status: "active",
        country: null,
        password: "hashed-password",
        createdTime: new Date(),
        modifiedTime: new Date(),
      };

      const mockQuery = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUser]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await service.findByEmail("test@example.com");

      expect(result).toBeDefined();
      expect(result?.email).toBe("test@example.com");
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should return null when user not found by email", async () => {
      const mockQuery = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await service.findByEmail("notfound@example.com");

      expect(result).toBeNull();
    });
  });

  describe("create", () => {
    it("should create a new user", async () => {
      const newUser = {
        id: "user-2",
        email: "newuser@example.com",
        nameEn: "New User",
        status: "active",
      };

      const mockCreatedUser = {
        id: "user-2",
        email: "newuser@example.com",
        nameEn: "New User",
        nameZh: null,
        gender: null,
        status: "active",
        country: null,
        createdTime: new Date(),
        modifiedTime: new Date(),
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockCreatedUser]),
      };

      mockDb.insert.mockReturnValue(mockInsert);

      const result = await service.create(newUser);

      expect(result).toBeDefined();
      expect(result.email).toBe("newuser@example.com");
      expect(result.id).toBe("user-2");
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockInsert.values).toHaveBeenCalledWith({
        id: "user-2",
        email: "newuser@example.com",
        nameEn: "New User",
        nameZh: null,
        gender: null,
        status: "active",
        country: null,
      });
      expect(mockInsert.returning).toHaveBeenCalled();
    });

    it("should throw error when email is missing", async () => {
      const newUser = {
        password: "hashed-password",
        nameEn: "New User",
      };

      await expect(service.create(newUser as any)).rejects.toThrow(
        "Email is required",
      );
    });

    // Password validation removed - Supabase manages credentials
  });

  describe("createWithRoles", () => {
    it("should create user and assign roles within a transaction", async () => {
      const newUser = {
        id: "user-3",
        email: "roleuser@example.com",
        nameEn: "Role User",
      };

      const mockCreatedUser = {
        id: "user-3",
        email: "roleuser@example.com",
        nameEn: "Role User",
        nameZh: null,
        gender: null,
        status: "active",
        country: null,
        createdTime: new Date(),
        modifiedTime: new Date(),
      };

      const mockUserInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockCreatedUser]),
      };

      const mockRoleInsert = {
        values: jest.fn().mockResolvedValue(undefined),
      };

      const rolesQuery = {
        from: jest.fn().mockReturnValue({
          where: jest
            .fn()
            .mockResolvedValue([{ roleId: "student" }, { roleId: "mentor" }]),
        }),
      };

      const mockTransaction = {
        insert: jest
          .fn()
          .mockReturnValueOnce(mockUserInsert)
          .mockReturnValueOnce(mockRoleInsert),
        select: jest.fn().mockReturnValue(rolesQuery),
      };

      mockDb.transaction.mockImplementation(async (callback) =>
        callback(mockTransaction as unknown as NodePgDatabase<typeof schema>),
      );

      const result = await service.createWithRoles(newUser, [
        "student",
        "mentor",
      ]);

      expect(result).toBeDefined();
      expect(result.roles).toEqual(["student", "mentor"]);
      expect(mockDb.transaction).toHaveBeenCalled();
      expect(mockTransaction.insert).toHaveBeenCalledTimes(2);
    });

    it("should throw error when roles array is empty", async () => {
      const newUser = {
        id: "user-4",
        email: "emptyroles@example.com",
      };

      await expect(
        service.createWithRoles(newUser as any, []),
      ).rejects.toThrow("At least one role is required");
    });
  });

  describe("update", () => {
    it("should update an existing user", async () => {
      const updateData = {
        nameEn: "Updated User",
        status: "inactive",
      };

      const mockUpdatedUser = {
        id: "user-1",
        email: "test@example.com",
        nameEn: "Updated User",
        nameZh: null,
        gender: null,
        status: "inactive",
        country: null,
        createdTime: new Date(),
        modifiedTime: new Date(),
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUpdatedUser]),
      };

      const rolesQuery = {
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockResolvedValue([{ roleId: "mentor" }]),
        }),
      };

      mockDb.update.mockReturnValue(mockUpdate);
      mockDb.select.mockReturnValue(rolesQuery);

      const result = await service.update("user-1", updateData);

      expect(result).toBeDefined();
      expect(result.nameEn).toBe("Updated User");
      expect(result.status).toBe("inactive");
      expect(result.roles).toEqual(["mentor"]);
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockUpdate.set).toHaveBeenCalled();
      expect(mockUpdate.where).toHaveBeenCalled();
      expect(mockUpdate.returning).toHaveBeenCalled();
      expect(mockDb.select).toHaveBeenCalled();
    });

    it("should throw error when user not found", async () => {
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };

      mockDb.update.mockReturnValue(mockUpdate);

      await expect(
        service.update("non-existent", { nameEn: "Test" }),
      ).rejects.toThrow("User with id non-existent not found");
    });
  });
});
