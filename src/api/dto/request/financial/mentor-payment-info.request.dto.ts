import { ApiProperty, getSchemaPath } from "@nestjs/swagger";
import {
  IsNotEmpty,
  IsObject,
  IsString,
  IsUUID,
} from "class-validator";
import { SettlementMethod } from "@domains/financial/dto/settlement";
import {
  ChannelBatchPayPaymentDetailsDto,
  CheckPaymentDetailsDto,
  DomesticTransferPaymentDetailsDto,
  GustoInternationalPaymentDetailsDto,
  GustoPaymentDetailsDto,
} from "./payment-details.dto";

export class CreateOrUpdateMentorPaymentInfoRequestDto {
  @ApiProperty({
    description: "Mentor ID (UUID). [导师ID(UUID)]",
    type: String,
    format: "uuid",
    required: true,
  })
  @IsUUID()
  @IsNotEmpty()
  mentorId!: string;

  @ApiProperty({
    description: "Payment currency (ISO 4217). [支付币种(ISO 4217)]",
    type: String,
    required: true,
    example: "USD",
  })
  @IsString()
  @IsNotEmpty()
  paymentCurrency!: string;

  @ApiProperty({
    description:
      "Payment method. Controls the structure of paymentDetails. [支付方式，决定paymentDetails结构]",
    enum: SettlementMethod,
    required: true,
    example: SettlementMethod.DOMESTIC_TRANSFER,
  })
  @IsString()
  @IsNotEmpty()
  paymentMethod!: SettlementMethod;

  @ApiProperty({
    description:
      "Payment details object. Must match the selected paymentMethod. [支付详情对象，需与paymentMethod匹配]",
    required: true,
    oneOf: [
      { $ref: getSchemaPath(DomesticTransferPaymentDetailsDto) },
      { $ref: getSchemaPath(GustoPaymentDetailsDto) },
      { $ref: getSchemaPath(GustoInternationalPaymentDetailsDto) },
      { $ref: getSchemaPath(CheckPaymentDetailsDto) },
      { $ref: getSchemaPath(ChannelBatchPayPaymentDetailsDto) },
    ],
  })
  @IsNotEmpty()
  @IsObject()
  paymentDetails!:
    | DomesticTransferPaymentDetailsDto
    | GustoPaymentDetailsDto
    | GustoInternationalPaymentDetailsDto
    | CheckPaymentDetailsDto
    | ChannelBatchPayPaymentDetailsDto;
}

