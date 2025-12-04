import { Controller, Post, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiCreatedResponse, ApiBody } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { RolesGuard } from "@shared/guards/roles.guard";
import { Roles } from "@shared/decorators/roles.decorator";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { User } from "@domains/identity/user/user-interface";
import { BookSessionCommand } from "@application/commands/booking/book-session.command";
import { BookSessionInput } from "@application/commands/booking/dto/book-session-input.dto";
import { BookSessionOutput } from "@application/commands/booking/dto/book-session-output.dto";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  Min,
  IsOptional,
} from "class-validator";
import { ApiPrefix } from "@api/api.constants";
import { BookSessionResponseDto } from "@api/dto/response/session-response.dto";
import { plainToInstance } from "class-transformer";

/**
 * API Layer - Book Session Request DTO
 * 顾问预约会话的请求DTO（前端提交的数据）
 */
class BookSessionRequestDto {
  @ApiProperty({
    description: "Student ID",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsString()
  @IsNotEmpty()
  studentId: string;

  @ApiProperty({
    description: "Mentor ID",
    example: "123e4567-e89b-12d3-a456-426614174001",
  })
  @IsString()
  @IsNotEmpty()
  mentorId: string;

  @ApiProperty({
    description: "Session start time (ISO 8601 format)",
    example: "2025-11-10T14:00:00Z",
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledStartTime: string;

  @ApiProperty({
    description: "Session duration (minutes)",
    example: 60,
  })
  @IsInt()
  @Min(15)
  duration: number;

  @ApiProperty({
    description: "Service type",
    example: "external",
  })
  @IsString()
  @IsNotEmpty()
  serviceType: string;

  @ApiProperty({
    description: "Session topic",
    example: "Resume review guidance",
  })
  @IsString()
  @IsNotEmpty()
  topic: string;

  @ApiProperty({
    description: "Meeting provider",
    example: "zoom",
    required: false,
  })
  @IsString()
  @IsOptional()
  meetingProvider?: string;
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
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("counselor")
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
  @ApiBody({ type: BookSessionRequestDto })
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
    @Body() dto: BookSessionRequestDto,
  ): Promise<BookSessionResponseDto> {
    // ✅ 直接调用 Application Layer 服务
    // 将前端 DTO 转换为 BookSessionInput
    const input: BookSessionInput = {
      counselorId: user.id,
      studentId: dto.studentId,
      mentorId: dto.mentorId,
      serviceType: dto.serviceType,
      scheduledStartTime: dto.scheduledStartTime,
      duration: dto.duration,
      topic: dto.topic,
      meetingProvider: dto.meetingProvider,
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
