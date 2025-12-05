import { ServiceType as DbServiceType } from '@infrastructure/database/schema/service-types.schema';

/**
 * Service Type Interface [服务类型接口]
 * Represents the classification standard for services
 * [代表服务的分类标准]
 */
export interface IServiceType extends DbServiceType {
  // Extend the database type with any additional domain-specific properties if needed
}

/**
 * Service Type Filter Interface [服务类型筛选接口]
 * Defines the filter criteria for searching service types
 * [定义服务类型查询的筛选条件]
 */
export interface IServiceTypeFilter {
  code?: string; // Service type code [服务类型编码]
  name?: string; // Service type name [服务类型名称]
  status?: string; // Service type status [服务类型状态]
  includeDeleted?: boolean; // Whether to include deleted service types [是否包含已删除的服务类型]
}
