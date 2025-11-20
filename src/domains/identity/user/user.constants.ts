export const USER_ROLES = ["student", "mentor", "counselor"] as const;
export type UserRole = (typeof USER_ROLES)[number];
