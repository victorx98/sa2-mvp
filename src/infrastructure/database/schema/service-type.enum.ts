import { pgEnum } from "drizzle-orm/pg-core";

// Type inference for TypeScript
export const ServiceType = pgEnum("service_type", [
  "onboarding",
  "review",
  "mock_interview",
  "session",
  "workshop",
]);
