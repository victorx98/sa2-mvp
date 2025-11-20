import { validate } from "class-validator";
import { UpdateMentoringDto } from "./update-mentoring.dto";
import { MentoringSessionStatus } from "../entities/mentoring-session.entity";

describe("UpdateMentoringDto", () => {
  it("should validate a valid DTO with all fields", async () => {
    const dto = new UpdateMentoringDto();
    dto.status = MentoringSessionStatus.COMPLETED;
    dto.serviceDuration = 3600;
    dto.feedback = "Great progress on understanding async patterns.";
    dto.rating = 5;
    dto.topic = "Advanced JavaScript";
    dto.notes = "Focus on closures and prototypes";

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should validate an empty DTO (all fields optional)", async () => {
    const dto = new UpdateMentoringDto();

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should validate DTO with only status", async () => {
    const dto = new UpdateMentoringDto();
    dto.status = MentoringSessionStatus.CANCELLED;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should validate DTO with only feedback", async () => {
    const dto = new UpdateMentoringDto();
    dto.feedback = "Student showed excellent understanding.";

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should validate DTO with only rating", async () => {
    const dto = new UpdateMentoringDto();
    dto.rating = 4;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should fail validation for invalid status", async () => {
    const dto = new UpdateMentoringDto();
    dto.status = "invalid_status" as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("status");
  });

  it("should fail validation for negative serviceDuration", async () => {
    const dto = new UpdateMentoringDto();
    dto.serviceDuration = -100;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("serviceDuration");
  });

  it("should fail validation for serviceDuration that is not an integer", async () => {
    const dto = new UpdateMentoringDto();
    dto.serviceDuration = 3600.5 as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("serviceDuration");
  });

  it("should fail validation for feedback exceeding max length", async () => {
    const dto = new UpdateMentoringDto();
    dto.feedback = "a".repeat(5001); // Max length is 5000

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("feedback");
  });

  it("should fail validation for rating less than 1", async () => {
    const dto = new UpdateMentoringDto();
    dto.rating = 0;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("rating");
  });

  it("should fail validation for rating greater than 5", async () => {
    const dto = new UpdateMentoringDto();
    dto.rating = 6;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("rating");
  });

  it("should fail validation for rating that is not an integer", async () => {
    const dto = new UpdateMentoringDto();
    dto.rating = 4.5 as any;

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("rating");
  });

  it("should validate rating of 1 (minimum)", async () => {
    const dto = new UpdateMentoringDto();
    dto.rating = 1;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should validate rating of 5 (maximum)", async () => {
    const dto = new UpdateMentoringDto();
    dto.rating = 5;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should fail validation for topic exceeding max length", async () => {
    const dto = new UpdateMentoringDto();
    dto.topic = "a".repeat(256); // Max length is 255

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("topic");
  });

  it("should fail validation for notes exceeding max length", async () => {
    const dto = new UpdateMentoringDto();
    dto.notes = "a".repeat(2001); // Max length is 2000

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe("notes");
  });

  it("should validate serviceDuration of 0 (minimum)", async () => {
    const dto = new UpdateMentoringDto();
    dto.serviceDuration = 0;

    const errors = await validate(dto);
    expect(errors.length).toBe(0);
  });

  it("should validate all valid status values", async () => {
    const statuses = [
      MentoringSessionStatus.SCHEDULED,
      MentoringSessionStatus.COMPLETED,
      MentoringSessionStatus.CANCELLED,
      MentoringSessionStatus.DELETED,
    ];

    for (const status of statuses) {
      const dto = new UpdateMentoringDto();
      dto.status = status;

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    }
  });
});

