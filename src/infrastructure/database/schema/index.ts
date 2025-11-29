// Shared enums
export * from "./enums";

// User and identity
export * from "./user.schema";
export * from "./student.schema";
export * from "./mentor.schema";
export * from "./counselor.schema";
export * from "./student-mentor.schema";
export * from "./student-counselor.schema";
export * from "./role.schema";
export * from "./user-relationships.schema";
export * from "./user-roles.schema";
export * from "./schools.schema";
export * from "./majors.schema";
export * from "./social-networks.schema";

// Catalog domain
export * from "./service-types.schema";
// Note: services.schema and service-packages.schema are removed as they're not needed in the project
// [注意：services.schema和service-packages.schema已被移除，因为项目中不需要它们]
export * from "./products.schema";
export * from "./product-items.schema";

// Contract domain
export * from "./contracts.schema";
export * from "./contract-service-entitlements.schema";
export * from "./contract-amendment-ledgers.schema";
export * from "./service-holds.schema";
export * from "./service-ledgers.schema";

// Services domain
export * from "./sessions.schema";
export * from "./session-events.schema"; // Legacy, kept for backward compatibility
export * from "./feishu-meeting-events.schema";
export * from "./zoom-meeting-events.schema";
export * from "./meetings.schema";
export * from "./mentoring-sessions.schema"; // Legacy, kept for backward compatibility
export * from "./session-types.schema";
export * from "./regular-mentoring-sessions.schema";
export * from "./gap-analysis-sessions.schema";
export * from "./ai-career-sessions.schema";
export * from "./service-references.schema";

// Financial domain
export * from "./mentor-payable-ledgers.schema";
export * from "./mentor-prices.schema";
export * from "./mentor-payment-infos.schema";
export * from "./settlement-ledgers.schema";
export * from "./settlement-details.schema";
export * from "./payment-params.schema";
export * from "./mentor-appeals.schema";

// Placement domain
export * from "./placement";

// Shared
export * from "./calendar.schema";
export * from "./notification-queue.schema";
