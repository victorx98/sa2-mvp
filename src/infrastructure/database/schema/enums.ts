import { pgEnum } from "drizzle-orm/pg-core";
import { COUNTRIES, GENDERS } from "@shared/types/identity-enums";

/**
 * 国家枚举 (ISO 3166-1 alpha-2)
 * Country enum following ISO 3166-1 alpha-2 standard
 * 
 * 用于多个表：schools, user 等
 * Used by multiple tables: schools, user, etc.
 * 
 * 通过 COUNTRIES 常量自动生成数组，避免手动维护
 * Automatically generated from COUNTRIES constant to avoid manual maintenance
 */
export const countryEnum = pgEnum("country", COUNTRIES as [string, ...string[]]);

/**
 * 性别枚举
 * Gender enum
 * 
 * 用于多个表：user 等
 * Used by multiple tables: user, etc.
 * 
 * 通过 GENDERS 常量自动生成数组，避免手动维护
 * Automatically generated from GENDERS constant to avoid manual maintenance
 */
export const genderEnum = pgEnum("gender", GENDERS as [string, ...string[]]);

