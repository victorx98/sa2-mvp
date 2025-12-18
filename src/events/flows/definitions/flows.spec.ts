import { BusinessFlows, validateAllFlows } from "./index";

describe("BusinessFlows (registry)", () => {
  it("registry keys should match flow.id", () => {
    Object.entries(BusinessFlows).forEach(([flowId, flow]) => {
      expect(flow.id).toBe(flowId);
    });
  });

  it("all registered flows should validate without warnings", () => {
    const results = validateAllFlows();

    results.forEach((result) => {
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });
  });
});
