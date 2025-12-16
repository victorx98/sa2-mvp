import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ClassMentorPriceStatus } from "@shared/types/financial-enums";

export class ClassMentorPriceResponseDto {
  @ApiProperty({ description: "Record ID (UUID). [记录ID(UUID)]", type: String })
  id!: string;

  @ApiProperty({ description: "Class ID (UUID). [班级ID(UUID)]", type: String })
  classId!: string;

  @ApiProperty({ description: "Mentor user ID (UUID). [导师用户ID(UUID)]", type: String })
  mentorUserId!: string;

  @ApiProperty({
    description: "Price per session (integer). [每次会话价格(整数)]",
    type: Number,
    example: 200,
  })
  pricePerSession!: number;

  @ApiProperty({
    description: "Status. [状态]",
    enum: ClassMentorPriceStatus,
    example: ClassMentorPriceStatus.ACTIVE,
  })
  status!: string;

  @ApiProperty({
    description: "Created time (ISO 8601). [创建时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Updated time (ISO 8601). [更新时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  updatedAt!: string;
}

export class MentorInfoResponseDto {
  @ApiProperty({
    description: "Mentor user ID (UUID). [导师用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  id!: string;

  @ApiPropertyOptional({
    description: "Mentor English name. [导师英文名]",
    type: String,
  })
  nameEn?: string | null;

  @ApiPropertyOptional({
    description: "Mentor Chinese name. [导师中文名]",
    type: String,
  })
  nameZh?: string | null;
}

export class ClassMentorPriceWithMentorResponseDto {
  @ApiProperty({ description: "Record ID (UUID). [记录ID(UUID)]", type: String })
  id!: string;

  @ApiProperty({ description: "Class ID (UUID). [班级ID(UUID)]", type: String })
  classId!: string;

  @ApiProperty({
    description: "Mentor object. [导师对象]",
    type: () => MentorInfoResponseDto,
  })
  mentor!: MentorInfoResponseDto;

  @ApiProperty({
    description: "Price per session. [每次会话价格]",
    type: Number,
    example: 200,
  })
  pricePerSession!: number;

  @ApiProperty({
    description: "Status. [状态]",
    type: String,
    example: ClassMentorPriceStatus.ACTIVE,
  })
  status!: string;

  @ApiProperty({
    description: "Created time (ISO 8601). [创建时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Updated time (ISO 8601). [更新时间(ISO 8601)]",
    type: String,
    format: "date-time",
  })
  updatedAt!: string;
}

export class PaginatedClassMentorPriceResponseDto {
  @ApiProperty({
    description: "Result list. [结果列表]",
    type: () => ClassMentorPriceWithMentorResponseDto,
    isArray: true,
  })
  data!: ClassMentorPriceWithMentorResponseDto[];

  @ApiProperty({ description: "Total count. [总数]", type: Number, example: 100 })
  total!: number;

  @ApiProperty({ description: "Page number. [页码]", type: Number, example: 1 })
  page!: number;

  @ApiProperty({ description: "Page size. [每页条数]", type: Number, example: 20 })
  pageSize!: number;

  @ApiProperty({ description: "Total pages. [总页数]", type: Number, example: 5 })
  totalPages!: number;
}

