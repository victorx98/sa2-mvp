import {
  MentoringSessionException,
  MentoringSessionNotFoundException,
  MentoringSessionValidationException,
  MentoringSessionStateException,
} from "./mentoring.exception";

describe("MentoringSessionException", () => {
  describe("MentoringSessionException", () => {
    it("should create exception with code", () => {
      const exception = new MentoringSessionException("TEST_ERROR");

      expect(exception).toBeInstanceOf(Error);
      expect(exception).toBeInstanceOf(MentoringSessionException);
      expect(exception.code).toBe("TEST_ERROR");
      expect(exception.message).toBe("TEST_ERROR");
      expect(exception.name).toBe("MentoringSessionException");
    });

    it("should create exception with code and custom message", () => {
      const exception = new MentoringSessionException(
        "TEST_ERROR",
        "Custom error message",
      );

      expect(exception.code).toBe("TEST_ERROR");
      expect(exception.message).toBe("Custom error message");
      expect(exception.name).toBe("MentoringSessionException");
    });

    it("should be throwable", () => {
      expect(() => {
        throw new MentoringSessionException("TEST_ERROR");
      }).toThrow(MentoringSessionException);
    });
  });

  describe("MentoringSessionNotFoundException", () => {
    it("should create exception with default message", () => {
      const exception = new MentoringSessionNotFoundException();

      expect(exception).toBeInstanceOf(MentoringSessionException);
      expect(exception).toBeInstanceOf(MentoringSessionNotFoundException);
      expect(exception.code).toBe("MENTORING_SESSION_NOT_FOUND");
      expect(exception.message).toBe("Mentoring session not found");
      expect(exception.name).toBe("MentoringSessionNotFoundException");
    });

    it("should create exception with custom message", () => {
      const exception = new MentoringSessionNotFoundException(
        "Session with ID xyz not found",
      );

      expect(exception.code).toBe("MENTORING_SESSION_NOT_FOUND");
      expect(exception.message).toBe("Session with ID xyz not found");
      expect(exception.name).toBe("MentoringSessionNotFoundException");
    });

    it("should be throwable", () => {
      expect(() => {
        throw new MentoringSessionNotFoundException();
      }).toThrow(MentoringSessionNotFoundException);

      expect(() => {
        throw new MentoringSessionNotFoundException();
      }).toThrow(MentoringSessionException);
    });

    it("should be catchable as base exception", () => {
      try {
        throw new MentoringSessionNotFoundException();
      } catch (error) {
        expect(error).toBeInstanceOf(MentoringSessionException);
        expect((error as MentoringSessionException).code).toBe(
          "MENTORING_SESSION_NOT_FOUND",
        );
      }
    });
  });

  describe("MentoringSessionValidationException", () => {
    it("should create exception with custom message", () => {
      const exception = new MentoringSessionValidationException(
        "Invalid rating value",
      );

      expect(exception).toBeInstanceOf(MentoringSessionException);
      expect(exception).toBeInstanceOf(MentoringSessionValidationException);
      expect(exception.code).toBe("MENTORING_SESSION_VALIDATION_ERROR");
      expect(exception.message).toBe("Invalid rating value");
      expect(exception.name).toBe("MentoringSessionValidationException");
    });

    it("should be throwable", () => {
      expect(() => {
        throw new MentoringSessionValidationException("Validation failed");
      }).toThrow(MentoringSessionValidationException);

      expect(() => {
        throw new MentoringSessionValidationException("Validation failed");
      }).toThrow(MentoringSessionException);
    });

    it("should be catchable as base exception", () => {
      try {
        throw new MentoringSessionValidationException("Invalid input");
      } catch (error) {
        expect(error).toBeInstanceOf(MentoringSessionException);
        expect((error as MentoringSessionException).code).toBe(
          "MENTORING_SESSION_VALIDATION_ERROR",
        );
      }
    });
  });

  describe("MentoringSessionStateException", () => {
    it("should create exception with custom message", () => {
      const exception = new MentoringSessionStateException(
        "Invalid state transition",
      );

      expect(exception).toBeInstanceOf(MentoringSessionException);
      expect(exception).toBeInstanceOf(MentoringSessionStateException);
      expect(exception.code).toBe("MENTORING_SESSION_STATE_ERROR");
      expect(exception.message).toBe("Invalid state transition");
      expect(exception.name).toBe("MentoringSessionStateException");
    });

    it("should be throwable", () => {
      expect(() => {
        throw new MentoringSessionStateException("State error");
      }).toThrow(MentoringSessionStateException);

      expect(() => {
        throw new MentoringSessionStateException("State error");
      }).toThrow(MentoringSessionException);
    });

    it("should be catchable as base exception", () => {
      try {
        throw new MentoringSessionStateException(
          "Cannot transition from completed to scheduled",
        );
      } catch (error) {
        expect(error).toBeInstanceOf(MentoringSessionException);
        expect((error as MentoringSessionException).code).toBe(
          "MENTORING_SESSION_STATE_ERROR",
        );
      }
    });
  });

  describe("Exception hierarchy", () => {
    it("should maintain proper inheritance chain", () => {
      const notFound = new MentoringSessionNotFoundException();
      const validation = new MentoringSessionValidationException("test");
      const state = new MentoringSessionStateException("test");

      // All should be instances of base exception
      expect(notFound).toBeInstanceOf(MentoringSessionException);
      expect(validation).toBeInstanceOf(MentoringSessionException);
      expect(state).toBeInstanceOf(MentoringSessionException);

      // All should be instances of Error
      expect(notFound).toBeInstanceOf(Error);
      expect(validation).toBeInstanceOf(Error);
      expect(state).toBeInstanceOf(Error);
    });

    it("should have unique error codes", () => {
      const notFound = new MentoringSessionNotFoundException();
      const validation = new MentoringSessionValidationException("test");
      const state = new MentoringSessionStateException("test");

      const codes = new Set([notFound.code, validation.code, state.code]);
      expect(codes.size).toBe(3); // All codes should be unique
    });
  });
});

