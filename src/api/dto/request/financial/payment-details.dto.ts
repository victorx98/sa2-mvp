import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class DomesticTransferPaymentDetailsDto {
  @ApiProperty({
    description: "Bank name. [银行名称]",
    type: String,
    required: true,
    example: "Bank of America",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  bankName!: string;

  @ApiProperty({
    description: "Bank account number. [银行卡号/账号]",
    type: String,
    required: true,
    example: "1234567890",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  accountNumber!: string;

  @ApiProperty({
    description: "Account holder name. [开户人姓名]",
    type: String,
    required: true,
    example: "John Doe",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  accountHolder!: string;
}

export class GustoPaymentDetailsDto {
  @ApiProperty({
    description: "Gusto employee ID. [Gusto 员工ID]",
    type: String,
    required: true,
    example: "emp_123",
  })
  @IsString()
  @IsNotEmpty()
  employeeId!: string;

  @ApiProperty({
    description: "Gusto company ID. [Gusto 公司ID]",
    type: String,
    required: true,
    example: "comp_456",
  })
  @IsString()
  @IsNotEmpty()
  companyId!: string;
}

export class GustoInternationalPaymentDetailsDto extends GustoPaymentDetailsDto {
  @ApiPropertyOptional({
    description:
      "Optional extra information for international payments. [国际支付可选补充信息]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  extraNote?: string;
}

export class CheckPaymentDetailsDto {
  @ApiProperty({
    description: "Payee name. [收款人姓名]",
    type: String,
    required: true,
    example: "John Doe",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  payee!: string;

  @ApiProperty({
    description: "Mailing address. [邮寄地址]",
    type: String,
    required: true,
    example: "123 Main St, San Jose, CA 95112, USA",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address!: string;
}

export class ChannelBatchPayPaymentDetailsDto {
  @ApiProperty({
    description:
      "Payment channel identifier. [支付渠道标识]",
    type: String,
    required: true,
    example: "channel_vendor_x",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  channel!: string;

  @ApiProperty({
    description:
      "Account identifier in the channel system. [渠道系统内账号标识]",
    type: String,
    required: true,
    example: "acct_789",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  accountIdentifier!: string;

  @ApiPropertyOptional({
    description:
      "Optional extra data required by the channel. [渠道可选扩展字段]",
    type: String,
    required: false,
  })
  @IsOptional()
  @IsString()
  extra?: string;
}

