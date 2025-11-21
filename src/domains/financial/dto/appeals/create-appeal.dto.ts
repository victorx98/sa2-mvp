/**
 * Create Appeal DTO (创建申诉DTO)
 *
 * This DTO defines the data structure for creating a new mentor appeal
 * (该DTO定义创建新导师申诉的数据结构)
 */

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsUUID,
  IsOptional,
  Min,
  MaxLength,
} from "class-validator";

export class CreateAppealDto {
  @IsUUID()
  @IsNotEmpty()
  mentorId: string; // Mentor ID submitting the appeal (提交申诉的导师ID)

  @IsUUID()
  @IsNotEmpty()
  counselorId: string; // Counselor ID assigned to process the appeal (指定处理该申诉的顾问ID)

  @IsUUID()
  @IsOptional()
  mentorPayableId?: string; // Associated payable ledger ID (optional) (关联应付账款ID - 可选)

  @IsUUID()
  @IsOptional()
  settlementId?: string; // Associated settlement batch ID (optional) (关联结算批次ID - 可选)

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  appealType: string; // Type of appeal: billing_error, missing_service, price_dispute, other (申诉类型)

  @IsString()
  @IsNotEmpty()
  appealAmount: string; // Amount being disputed or requested, as string to match database type (申诉金额，以字符串形式匹配数据库类型)

  @IsString()
  @IsNotEmpty()
  @MaxLength(3)
  currency: string; // ISO 4217 currency code (货币代码,如USD,CNY)

  @IsString()
  @IsNotEmpty()
  reason: string; // Detailed description of the appeal (申诉的详细理由)
}
