// Catalog Domain Enums

/**
 * 服务计量单位枚举
 * 定义服务的计量方式，如按小时、按会话等
 */
export enum ServiceUnit {
  HOUR = "HOUR",
  SESSIONS = "SESSIONS",
  PACKAGE = "PACKAGE",
  UNIT = "UNIT",
}

/**
 * 产品状态枚举
 * 定义产品在生命周期中的不同状态
 */
export enum ProductStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DELETED = "DELETED",
}

/**
 * 货币类型枚举
 * 定义系统支持的货币单位
 */
export enum Currency {
  USD = "USD",
  CNY = "CNY",
  EUR = "EUR",
  GBP = "GBP",
  JPY = "JPY",
}

/**
 * 用户类型枚举
 * 定义系统中的不同用户角色
 */
export enum UserType {
  MENTOR = "MENTOR",
  STUDENT = "STUDENT",
  ADMIN = "ADMIN",
  COUNSELOR = "COUNSELOR",
}

/**
 * 产品项类型枚举
 * 定义产品项的不同类型
 */
export enum ProductItemType {
  SERVICE = "SERVICE",
  SERVICE_PACKAGE = "SERVICE_PACKAGE",
}

/**
 * 服务状态常量
 * 定义服务的激活状态
 */
export enum ServiceStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  DELETED = "deleted",
}

/**
 * 计费模式枚举
 * 定义服务的计费方式
 */
export enum BillingMode {
  ONE_TIME = "one_time",
  PER_SESSION = "per_session",
  STAGED = "staged",
  PACKAGE = "package",
}

export enum UserPersona {
  UNDERGRADUATE = "undergraduate", // Undergraduate
  GRADUATE = "graduate", // Graduate
  WORKING = "working", // Working professional
}


export type MarketingLabel = "hot" | "new" | "recommended";
