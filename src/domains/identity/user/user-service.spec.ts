import { Test, TestingModule } from "@nestjs/testing";
import { UserService } from "./user-service";
import { DATABASE_CONNECTION } from "@infrastructure/database/database.provider";
import * as schema from "@infrastructure/database/schema";
import { NodePgDatabase } from "drizzle-orm/node-postgres";

describe("UserService", () => {
  let service: UserService;
  let db: NodePgDatabase<typeof schema>;

  const mockDb = {
    select: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
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
    db = module.get<NodePgDatabase<typeof schema>>(DATABASE_CONNECTION);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("findById", () => {
    it("should return user when found", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        nickname: "Test User",
        cnNickname: "测试用户",
        gender: "male",
        status: "active",
        country: "CN",
        password: "hashed-password",
        createdTime: new Date(),
        modifiedTime: new Date(),
        createdBy: null,
        updatedBy: null,
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
        nickname: "Test User",
        cnNickname: null,
        gender: null,
        status: "active",
        country: null,
        password: "hashed-password",
        createdTime: new Date(),
        modifiedTime: new Date(),
        createdBy: null,
        updatedBy: null,
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

  describe("findByEmailWithPassword", () => {
    it("should return user with password when found", async () => {
      const mockUser = {
        id: "user-1",
        email: "test@example.com",
        nickname: "Test User",
        cnNickname: null,
        gender: null,
        status: "active",
        country: null,
        password: "hashed-password",
        createdTime: new Date(),
        modifiedTime: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      const mockQuery = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([mockUser]),
      };

      mockDb.select.mockReturnValue(mockQuery);

      const result = await service.findByEmailWithPassword(
        "test@example.com",
      );

      expect(result).toBeDefined();
      expect(result?.email).toBe("test@example.com");
      expect(result?.password).toBe("hashed-password");
    });
  });

  describe("create", () => {
    it("should create a new user", async () => {
      const newUser = {
        email: "newuser@example.com",
        password: "hashed-password",
        nickname: "New User",
        status: "active",
      };

      const mockCreatedUser = {
        id: "user-2",
        email: "newuser@example.com",
        nickname: "New User",
        cnNickname: null,
        gender: null,
        status: "active",
        country: null,
        password: "hashed-password",
        createdTime: new Date(),
        modifiedTime: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      const mockInsert = {
        values: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockCreatedUser]),
      };

      mockDb.insert.mockReturnValue(mockInsert);

      const result = await service.create(newUser);

      expect(result).toBeDefined();
      expect(result.email).toBe("newuser@example.com");
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockInsert.values).toHaveBeenCalled();
      expect(mockInsert.returning).toHaveBeenCalled();
    });

    it("should throw error when email is missing", async () => {
      const newUser = {
        password: "hashed-password",
        nickname: "New User",
      };

      await expect(service.create(newUser as any)).rejects.toThrow(
        "Email is required",
      );
    });

    it("should throw error when password is missing", async () => {
      const newUser = {
        email: "newuser@example.com",
        nickname: "New User",
      };

      await expect(service.create(newUser as any)).rejects.toThrow(
        "Password is required",
      );
    });
  });

  describe("update", () => {
    it("should update an existing user", async () => {
      const updateData = {
        nickname: "Updated User",
        status: "inactive",
      };

      const mockUpdatedUser = {
        id: "user-1",
        email: "test@example.com",
        nickname: "Updated User",
        cnNickname: null,
        gender: null,
        status: "inactive",
        country: null,
        password: "hashed-password",
        createdTime: new Date(),
        modifiedTime: new Date(),
        createdBy: null,
        updatedBy: null,
      };

      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([mockUpdatedUser]),
      };

      mockDb.update.mockReturnValue(mockUpdate);

      const result = await service.update("user-1", updateData);

      expect(result).toBeDefined();
      expect(result.nickname).toBe("Updated User");
      expect(result.status).toBe("inactive");
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockUpdate.set).toHaveBeenCalled();
      expect(mockUpdate.where).toHaveBeenCalled();
      expect(mockUpdate.returning).toHaveBeenCalled();
    });

    it("should throw error when user not found", async () => {
      const mockUpdate = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        returning: jest.fn().mockResolvedValue([]),
      };

      mockDb.update.mockReturnValue(mockUpdate);

      await expect(
        service.update("non-existent", { nickname: "Test" }),
      ).rejects.toThrow("User with id non-existent not found");
    });
  });
});

