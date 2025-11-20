import { validate } from "class-validator";
import { CreateMentoringDto } from "./create-mentoring.dto";

describe("CreateMentoringDto", () => {
  it("should validate a valid DTO", async () => {
    const dto = new CreateMentoringDto();
    dto.meetingId = "550e8400-e29b-41d4-a716-446655440000";
    dto.studentId = "550e8400-e29b-41d4-a716-446655440001";
    dto.mentorId = "550e8400-e29b-41d4-a716-446655440002";
    dto.topic = "JavaScript Fundamentals";
    dto.notes = "Focus on async/await patterns";

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should validate a minimal valid DTO without optional fields", async () => {
    const dto = new CreateMentoringDto();
    dto.meetingId = "550e8400-e29b-41d4-a716-446655440000";
    dto.studentId = "550e8400-e29b-41d4-a716-446655440001";
    dto.mentorId = "550e8400-e29b-41d4-a716-446655440002";

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should fail validation when meetingId is not a UUID", async () => {
    const dto = new CreateMentoringDto();
    dto.meetingId = "invalid-uuid";
    dto.studentId = "550e8400-e29b-41d4-a716-446655440001";
    dto.mentorId = "550e8400-e29b-41d4-a716-446655440002";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("meetingId");
  });

  it("should fail validation when studentId is not a UUID", async () => {
    const dto = new CreateMentoringDto();
    dto.meetingId = "550e8400-e29b-41d4-a716-446655440000";
    dto.studentId = "invalid-uuid";
    dto.mentorId = "550e8400-e29b-41d4-a716-446655440002";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("studentId");
  });

  it("should fail validation when mentorId is not a UUID", async () => {
    const dto = new CreateMentoringDto();
    dto.meetingId = "550e8400-e29b-41d4-a716-446655440000";
    dto.studentId = "550e8400-e29b-41d4-a716-446655440001";
    dto.mentorId = "invalid-uuid";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("mentorId");
  });

  it("should fail validation when meetingId is missing", async () => {
    const dto = new CreateMentoringDto();
    dto.studentId = "550e8400-e29b-41d4-a716-446655440001";
    dto.mentorId = "550e8400-e29b-41d4-a716-446655440002";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === "meetingId")).toBe(true);
  });

  it("should fail validation when studentId is missing", async () => {
    const dto = new CreateMentoringDto();
    dto.meetingId = "550e8400-e29b-41d4-a716-446655440000";
    dto.mentorId = "550e8400-e29b-41d4-a716-446655440002";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === "studentId")).toBe(true);
  });

  it("should fail validation when mentorId is missing", async () => {
    const dto = new CreateMentoringDto();
    dto.meetingId = "550e8400-e29b-41d4-a716-446655440000";
    dto.studentId = "550e8400-e29b-41d4-a716-446655440001";

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === "mentorId")).toBe(true);
  });

  it("should fail validation when topic exceeds max length", async () => {
    const dto = new CreateMentoringDto();
    dto.meetingId = "550e8400-e29b-41d4-a716-446655440000";
    dto.studentId = "550e8400-e29b-41d4-a716-446655440001";
    dto.mentorId = "550e8400-e29b-41d4-a716-446655440002";
    dto.topic = "a".repeat(256); // Max length is 255

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("topic");
  });

  it("should fail validation when notes exceed max length", async () => {
    const dto = new CreateMentoringDto();
    dto.meetingId = "550e8400-e29b-41d4-a716-446655440000";
    dto.studentId = "550e8400-e29b-41d4-a716-446655440001";
    dto.mentorId = "550e8400-e29b-41d4-a716-446655440002";
    dto.notes = "a".repeat(2001); // Max length is 2000

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("notes");
  });
});

