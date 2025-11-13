import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { User } from "@domains/identity/user/user-interface";
import { BookSessionCommand } from "@application/commands/booking/book-session.command";
import { BookSessionOutput } from "@application/commands/booking/dto/book-session-output.dto";
import { BookSessionInput } from "@application/commands/booking/dto/book-session-input.dto";
import { ApiProperty } from "@nestjs/swagger";
import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsInt,
  Min,
  IsOptional,
} from "class-validator";

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
    description: "Contract ID",
    example: "123e4567-e89b-12d3-a456-426614174002",
  })
  @IsString()
  @IsNotEmpty()
  contractId: string;

  @ApiProperty({
    description: "Service ID",
    example: "service-1v1-session",
  })
  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @ApiProperty({
    description: "Session start time (ISO 8601 format)",
    example: "2025-11-10T14:00:00Z",
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledStartTime: string;

  @ApiProperty({
    description: "Session end time (ISO 8601 format)",
    example: "2025-11-10T15:00:00Z",
  })
  @IsDateString()
  @IsNotEmpty()
  scheduledEndTime: string;

  @ApiProperty({
    description: "Session duration (minutes)",
    example: 60,
  })
  @IsInt()
  @Min(15)
  duration: number;

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
 * API Layer - Counselor Sessions Controller
 * 路由：/api/counselor/sessions
 *
 * 职责：
 * 1. 定义HTTP路由
 * 2. 参数提取和验证
 * 3. 调用 Application Layer 服务
 * 4. 返回HTTP响应
 */
@ApiTags("Counselor Portal - Sessions")
@Controller("api/counselor/sessions")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CounselorSessionsController {
  constructor(
    // ✅ 直接注入 Application Layer 服务
    private readonly bookSessionCommand: BookSessionCommand,
  ) {}

  /**
   * 预约会话
   * POST /api/counselor/sessions
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Counselor books a session for a student",
    description: `
      Counselors book a one-on-one coaching session for their assigned students.

      Flow:
      1. Validate counselor permissions
      2. Check student service balance
      3. Verify mentor availability
      4. Create the session booking
      5. Reserve the calendar slot
      6. Create the meeting link
      7. Send notifications
    `,
  })
  @ApiResponse({
    status: 201,
    description: "Booking created successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Invalid request parameters or insufficient balance",
  })
  @ApiResponse({
    status: 403,
    description: "Not authorized to book for this student",
  })
  @ApiResponse({
    status: 409,
    description: "Timeslot conflict (mentor already scheduled)",
  })
  async bookSession(
    @CurrentUser() user: User,
    @Body() dto: BookSessionRequestDto,
  ): Promise<BookSessionOutput> {
    // ✅ 直接调用 Application Layer 服务
    // 将前端 DTO 转换为 BookSessionInput
    // 注意：serviceType 暂时硬编码为 'session'，未来需要从 serviceId 查询
    const input: BookSessionInput = {
      counselorId: user.id,
      studentId: dto.studentId,
      mentorId: dto.mentorId,
      contractId: dto.contractId,
      serviceType: "session" as any, // TODO: 从 serviceId 查询 serviceType
      scheduledStartTime: new Date(dto.scheduledStartTime),
      scheduledEndTime: new Date(dto.scheduledEndTime),
      duration: dto.duration,
      topic: dto.topic,
      meetingProvider: dto.meetingProvider,
    };

    return await this.bookSessionCommand.execute(input);
  }
}
