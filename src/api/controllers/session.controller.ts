import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiCreatedResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { User } from "@domains/identity/user/user-interface";
import { BookSessionCommand } from "@application/commands/booking/book-session.command";
import { BookSessionInput } from "@application/commands/booking/dto/book-session-input.dto";
import { BookSessionOutput } from "@application/commands/booking/dto/book-session-output.dto";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsDateString,
  IsOptional,
} from "class-validator";
import { ServiceType } from "@infrastructure/database/schema/service-types.schema";
import { ApiPrefix } from "@api/api.constants";
import { BookSessionResponseDto } from "@api/dto/response/session-response.dto";
import { plainToInstance } from "class-transformer";

/**
 * API Layer - Book Session Request DTO
 * 预约课程的请求参数
 */
class BookSessionDto {
  @ApiProperty({ description: "Student ID" })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({ description: "Contract ID" })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({ description: "Mentor ID" })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({
    description: "Start time (ISO 8601 format)",
    example: "2024-01-20T10:00:00Z",
  })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({ description: "Duration (minutes)", example: 60 })
  @IsNumber()
  @IsNotEmpty()
  duration: number;

  @ApiProperty({ description: "Session name" })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description:
      "Service type (e.g., gap_analysis, individual_session, mock_interview)",
    required: false,
  })
  @IsString()
  @IsOptional()
  serviceType?: ServiceType;

  @ApiProperty({
    description: "Meeting provider (optional, defaults to zoom)",
    enum: ["zoom", "teams", "google_meet", "feishu"],
    required: false,
  })
  @IsString()
  @IsOptional()
  provider?: string;
}

/**
 * API Layer - Session Controller
 * 职责：提供会话相关的 HTTP 接口
 * 特点：薄控制器，只负责路由和参数验证，业务逻辑委托给 Application Layer
 *
 * 注意：此控制器用于学生自己预约，但 BookSessionCommand 需要 counselorId
 * 暂时使用学生的 ID 作为 counselorId，未来可能需要调整
 */
@ApiTags("Sessions")
@Controller(`${ApiPrefix}/sessions`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SessionController {
  constructor(
    // ✅ 直接注入 Application Layer 服务
    private readonly bookSessionCommand: BookSessionCommand,
  ) {}

  /**
   * 预约课程
   * POST /sessions/book
   */
  @Post("book")
  @ApiOperation({ summary: "Book a session" })
  @ApiCreatedResponse({
    description: "Booking created successfully",
    type: BookSessionResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request parameters or insufficient balance",
  })
  @ApiResponse({
    status: 409,
    description: "Timeslot conflict; mentor unavailable",
  })
  async bookSession(
    @CurrentUser() user: User,
    @Body() bookSessionDto: BookSessionDto,
  ): Promise<BookSessionResponseDto> {
    // ✅ 直接调用 Application Layer 服务
    // 注意：对于学生自己预约，暂时使用学生的 ID 作为 counselorId
    const input: BookSessionInput = {
      counselorId: user.id, // TODO: 学生自己预约时，可能需要不同的处理
      studentId: bookSessionDto.studentId,
      mentorId: bookSessionDto.mentorId,
      scheduledStartTime: bookSessionDto.startTime,
      duration: bookSessionDto.duration,
      topic: bookSessionDto.name,
      meetingProvider: bookSessionDto.provider,
    };

    const result = await this.bookSessionCommand.execute(input);
    return this.toBookSessionResponseDto(result);
  }

  private toBookSessionResponseDto(result: BookSessionOutput): BookSessionResponseDto {
    return plainToInstance(BookSessionResponseDto, result, {
      enableImplicitConversion: false,
    });
  }
}
