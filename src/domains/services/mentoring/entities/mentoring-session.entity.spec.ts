import {
  MentoringSessionStatus,
  MentoringSessionEntity,
  CreateMentoringSessionInput,
  UpdateMentoringSessionInput,
} from "./mentoring-session.entity";

describe("MentoringSessionEntity", () => {
  describe("MentoringSessionStatus", () => {
    it("should have correct status values", () => {
      expect(MentoringSessionStatus.SCHEDULED).toBe("scheduled");
      expect(MentoringSessionStatus.COMPLETED).toBe("completed");
      expect(MentoringSessionStatus.CANCELLED).toBe("cancelled");
      expect(MentoringSessionStatus.DELETED).toBe("deleted");
    });

    it("should have all expected status values", () => {
      const statuses = Object.values(MentoringSessionStatus);
      expect(statuses).toContain("scheduled");
      expect(statuses).toContain("completed");
      expect(statuses).toContain("cancelled");
      expect(statuses).toContain("deleted");
      expect(statuses.length).toBe(4);
    });
  });

  describe("MentoringSessionEntity", () => {
    it("should have correct entity structure", () => {
      const entity: MentoringSessionEntity = {
        id: "session-uuid-123",
        meetingId: "meeting-uuid-123",
        studentId: "student-uuid-123",
        mentorId: "mentor-uuid-123",
        status: MentoringSessionStatus.SCHEDULED,
        serviceDuration: null,
        feedback: null,
        rating: null,
        topic: "JavaScript Fundamentals",
        notes: "Focus on async/await",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      expect(entity.id).toBeDefined();
      expect(entity.meetingId).toBeDefined();
      expect(entity.studentId).toBeDefined();
      expect(entity.mentorId).toBeDefined();
      expect(entity.status).toBe(MentoringSessionStatus.SCHEDULED);
    });

    it("should allow completed status with service duration", () => {
      const entity: MentoringSessionEntity = {
        id: "session-uuid-123",
        meetingId: "meeting-uuid-123",
        studentId: "student-uuid-123",
        mentorId: "mentor-uuid-123",
        status: MentoringSessionStatus.COMPLETED,
        serviceDuration: 3600,
        feedback: "Great session!",
        rating: 5,
        topic: "JavaScript Fundamentals",
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      expect(entity.status).toBe(MentoringSessionStatus.COMPLETED);
      expect(entity.serviceDuration).toBe(3600);
      expect(entity.feedback).toBe("Great session!");
      expect(entity.rating).toBe(5);
    });

    it("should allow cancelled status", () => {
      const entity: MentoringSessionEntity = {
        id: "session-uuid-123",
        meetingId: "meeting-uuid-123",
        studentId: "student-uuid-123",
        mentorId: "mentor-uuid-123",
        status: MentoringSessionStatus.CANCELLED,
        serviceDuration: null,
        feedback: null,
        rating: null,
        topic: null,
        notes: "[Cancelled] Student requested reschedule",
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      expect(entity.status).toBe(MentoringSessionStatus.CANCELLED);
      expect(entity.notes).toContain("Cancelled");
    });

    it("should allow deleted status with deletedAt timestamp", () => {
      const entity: MentoringSessionEntity = {
        id: "session-uuid-123",
        meetingId: "meeting-uuid-123",
        studentId: "student-uuid-123",
        mentorId: "mentor-uuid-123",
        status: MentoringSessionStatus.DELETED,
        serviceDuration: null,
        feedback: null,
        rating: null,
        topic: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      };

      expect(entity.status).toBe(MentoringSessionStatus.DELETED);
      expect(entity.deletedAt).toBeInstanceOf(Date);
    });
  });

  describe("CreateMentoringSessionInput", () => {
    it("should have correct input structure", () => {
      const input: CreateMentoringSessionInput = {
        meetingId: "meeting-uuid-123",
        studentId: "student-uuid-123",
        mentorId: "mentor-uuid-123",
        topic: "JavaScript Fundamentals",
        notes: "Focus on async/await",
      };

      expect(input.meetingId).toBeDefined();
      expect(input.studentId).toBeDefined();
      expect(input.mentorId).toBeDefined();
      expect(input.topic).toBe("JavaScript Fundamentals");
      expect(input.notes).toBe("Focus on async/await");
    });

    it("should allow minimal input without optional fields", () => {
      const input: CreateMentoringSessionInput = {
        meetingId: "meeting-uuid-123",
        studentId: "student-uuid-123",
        mentorId: "mentor-uuid-123",
      };

      expect(input.meetingId).toBeDefined();
      expect(input.studentId).toBeDefined();
      expect(input.mentorId).toBeDefined();
      expect(input.topic).toBeUndefined();
      expect(input.notes).toBeUndefined();
    });
  });

  describe("UpdateMentoringSessionInput", () => {
    it("should allow partial updates", () => {
      const input: UpdateMentoringSessionInput = {
        feedback: "Excellent progress!",
        rating: 5,
      };

      expect(input.feedback).toBe("Excellent progress!");
      expect(input.rating).toBe(5);
      expect(input.status).toBeUndefined();
      expect(input.serviceDuration).toBeUndefined();
    });

    it("should allow status update", () => {
      const input: UpdateMentoringSessionInput = {
        status: MentoringSessionStatus.COMPLETED,
      };

      expect(input.status).toBe(MentoringSessionStatus.COMPLETED);
    });

    it("should allow service duration update", () => {
      const input: UpdateMentoringSessionInput = {
        serviceDuration: 3600,
      };

      expect(input.serviceDuration).toBe(3600);
    });

    it("should allow all fields to be updated", () => {
      const input: UpdateMentoringSessionInput = {
        status: MentoringSessionStatus.COMPLETED,
        serviceDuration: 3600,
        feedback: "Great session!",
        rating: 5,
        topic: "Advanced JavaScript",
        notes: "Covered closures and prototypes",
      };

      expect(input.status).toBe(MentoringSessionStatus.COMPLETED);
      expect(input.serviceDuration).toBe(3600);
      expect(input.feedback).toBe("Great session!");
      expect(input.rating).toBe(5);
      expect(input.topic).toBe("Advanced JavaScript");
      expect(input.notes).toBe("Covered closures and prototypes");
    });

    it("should allow empty updates", () => {
      const input: UpdateMentoringSessionInput = {};

      expect(Object.keys(input).length).toBe(0);
    });
  });
});

