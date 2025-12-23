import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IPaginatedResult } from "@shared/types/paginated-result";

export class MentorInfoDto {
  @ApiProperty({
    description: "导师用户ID (UUID). [Mentor user ID (UUID)]",
    type: String,
    format: "uuid",
  })
  mentorId!: string;

  @ApiPropertyOptional({
    description: "导师中文名称. [Mentor Chinese name]",
    type: String,
    nullable: true,
  })
  name_cn?: string | null;

  @ApiPropertyOptional({
    description: "导师英文名称. [Mentor English name]",
    type: String,
    nullable: true,
  })
  name_en?: string | null;
}

export class MentorPriceResponseDto {
  @ApiProperty({ description: "Mentor price ID (UUID). [导师价格ID(UUID)]", type: String })
  id!: string;

  @ApiProperty({
    description: "Mentor user ID (UUID). [导师用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  mentorUserId!: string;

  @ApiPropertyOptional({
    description: "Service type ID (deprecated). [服务类型ID(已废弃)]",
    type: String,
  })
  serviceTypeId?: string | null;

  @ApiPropertyOptional({
    description: "Session type code. [会话类型代码]",
    type: String,
    example: "regular_mentoring",
  })
  sessionTypeCode?: string | null;

  @ApiPropertyOptional({
    description: "Package code (optional). [课程包编码(可选)]",
    type: String,
  })
  packageCode?: string | null;

  @ApiProperty({
    description:
      "Price stored as decimal string (DB numeric/decimal). [价格(字符串，DB numeric/decimal)]",
    type: String,
    example: "200.0",
  })
  price!: string;

  @ApiProperty({
    description: "Currency (ISO 4217). [币种(ISO 4217)]",
    type: String,
    example: "USD",
  })
  currency!: string;

  @ApiProperty({
    description: "Status (active/inactive). [状态：active/inactive]",
    type: String,
    example: "active",
  })
  status!: string;

  @ApiPropertyOptional({
    description: "Updated by user ID (UUID). [更新人用户ID(UUID)]",
    type: String,
    format: "uuid",
  })
  updatedBy?: string | null;

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

export class MentorPriceWithMentorResponseDto extends MentorPriceResponseDto {
  @ApiProperty({
    description: "导师信息. [Mentor information]",
    type: MentorInfoDto,
  })
  mentor!: MentorInfoDto;
}

export class PaginatedMentorPriceResponseDto
  implements IPaginatedResult<MentorPriceWithMentorResponseDto>
{
  @ApiProperty({
    description: "数据列表. [Data list]",
    type: [MentorPriceWithMentorResponseDto],
  })
  data!: MentorPriceWithMentorResponseDto[];

  @ApiProperty({
    description: "总记录数. [Total records count]",
    type: Number,
  })
  total!: number;

  @ApiProperty({
    description: "当前页码. [Current page number]",
    type: Number,
  })
  page!: number;

  @ApiProperty({
    description: "每页条数. [Page size]",
    type: Number,
  })
  pageSize!: number;

  @ApiProperty({
    description: "总页数. [Total pages]",
    type: Number,
  })
  totalPages!: number;
}

