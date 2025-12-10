import {
  IsNotEmpty,
  IsUUID,
  IsString,
  IsObject,
  IsOptional,
  IsEnum,
} from "class-validator";
import { ContractStatus } from "@shared/types/contract-enums";
import { IProductSnapshot } from "../common/types/snapshot.types";

/**
 * DTO for creating contract (创建合约的DTO)
 * Used when creating a new contract from a product (用于从产品创建新合约)
 */
export class CreateContractDto {
  @IsNotEmpty()
  @IsString()
  studentId: string; // Student ID (学生ID)

  @IsNotEmpty()
  @IsUUID()
  productId: string; // Product ID (产品ID)

  @IsNotEmpty()
  @IsObject()
  // productSnapshot structure is validated in business logic layer
  // [productSnapshot结构在业务逻辑层进行验证]
  // Note: @ValidateNested() cannot be used with interface types
  // [注意：@ValidateNested()不能用于接口类型]
  productSnapshot: IProductSnapshot; // Product snapshot (产品快照)

  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus; // Initial contract status, defaults to DRAFT (初始合同状态，默认为DRAFT)
  // Only DRAFT or SIGNED is allowed for initial status [初始状态只允许DRAFT或SIGNED]

  // createdBy is set by controller from JWT token, should not be provided by client
  // [createdBy由控制器从JWT token中获取，不应由客户端提供]

  @IsOptional()
  @IsString()
  title?: string; // Contract title (合约标题)
}
