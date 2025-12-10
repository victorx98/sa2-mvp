import { IsOptional, IsString, IsBoolean } from "class-validator";

/**
 * Service Type Filter DTO [服务类型筛选DTO]
 * Used for filtering service types in API requests
 * [用于API请求中筛选服务类型]
 */
export class ServiceTypeFilterDto {
  @IsOptional()
  @IsString()
  code?: string; // Service type code [服务类型编码]

  @IsOptional()
  @IsString()
  name?: string; // Service type name [服务类型名称]

  @IsOptional()
  @IsString()
  status?: string; // Service type status [服务类型状态]

  @IsOptional()
  @IsBoolean()
  includeDeleted?: boolean; // Whether to include deleted service types [是否包含已删除的服务类型]
}
