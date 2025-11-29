// Identity Domain Enums

/**
 * 国家枚举 (ISO 3166-1 alpha-2)
 * Country enum following ISO 3166-1 alpha-2 standard
 */
export enum Country {
  US = "US", // 美国 United States
  CN = "CN", // 中国 China
  GB = "GB", // 英国 United Kingdom
  CA = "CA", // 加拿大 Canada
}

/**
 * 性别枚举
 * Gender enum
 */
export enum Gender {
  MALE = "male",
  FEMALE = "female",
}

/**
 * 国家数组（用于验证）
 * Country array for validation
 */
export const COUNTRIES = Object.values(Country) as Country[];
export type CountryType = Country;

/**
 * 性别数组（用于验证）
 * Gender array for validation
 */
export const GENDERS = Object.values(Gender) as Gender[];
export type GenderType = Gender;

