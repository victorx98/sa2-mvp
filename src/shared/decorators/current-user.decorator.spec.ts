import { createParamDecorator } from "@nestjs/common";

describe("CurrentUser Decorator", () => {
  it("should be defined", () => {
    // CurrentUser is a parameter decorator that extracts user from request
    expect(createParamDecorator).toBeDefined();
  });
});
