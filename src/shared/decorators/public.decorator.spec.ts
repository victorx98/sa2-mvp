import { SetMetadata } from "@nestjs/common";
import { Public, IS_PUBLIC_KEY } from "./public.decorator";

// Mock SetMetadata
jest.mock("@nestjs/common", () => ({
  ...jest.requireActual("@nestjs/common"),
  SetMetadata: jest.fn(),
}));

describe("Public Decorator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should set metadata with IS_PUBLIC_KEY and true value", () => {
    Public();

    expect(SetMetadata).toHaveBeenCalledWith(IS_PUBLIC_KEY, true);
  });

  it("should export IS_PUBLIC_KEY constant", () => {
    expect(IS_PUBLIC_KEY).toBe("isPublic");
  });
});
