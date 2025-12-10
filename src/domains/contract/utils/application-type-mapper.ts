/**
 * Application Type Mapper [投递类型映射器]
 *
 * Maps placement application types to service types for entitlement management
 * 将投递类型映射到权益管理的服务类型
 *
 * This mapper ensures synchronization between service_types table data and business logic
 * 该映射器确保service_types表数据与业务逻辑之间的同步
 */

import { applicationTypeEnum } from "@infrastructure/database/schema/placement.schema";

export type ApplicationType = (typeof applicationTypeEnum.enumValues)[number];

/**
 * Service type mapping configuration
 * 服务类型映射配置
 *
 * This mapping should be synchronized with the service_types table in the database
 * 此映射应与数据库中的service_types表同步
 */
export const APPLICATION_TYPE_TO_SERVICE_TYPE_MAP: Record<
  ApplicationType,
  string
> = {
  direct: "job_application",
  proxy: "job_application",
  referral: "job_application",
  bd: "job_application",
};

/**
 * Get service type from application type
 * 从投递类型获取服务类型
 *
 * @param applicationType Placement application type [投递类型]
 * @returns Corresponding service type for entitlement management [权益管理对应的服务类型]
 */
export function getServiceTypeFromApplicationType(
  applicationType: ApplicationType,
): string {
  return (
    APPLICATION_TYPE_TO_SERVICE_TYPE_MAP[applicationType] || "job_application"
  );
}

/**
 * Validate if service type exists in the mapping
 * 验证服务类型是否存在于映射中
 *
 * @param serviceType Service type to validate [要验证的服务类型]
 * @returns True if service type is valid, false otherwise [如果服务类型有效则返回true，否则返回false]
 */
export function isValidServiceType(serviceType: string): boolean {
  const validServiceTypes = new Set(
    Object.values(APPLICATION_TYPE_TO_SERVICE_TYPE_MAP),
  );
  return validServiceTypes.has(serviceType);
}
