import {
  Controller,
  Get,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiOkResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { ApiPrefix } from '@api/api.constants';
import { GetCalendarEventsUseCase } from '@application/queries/calendar/use-cases/get-calendar-events.use-case';
import { GetCalendarEventsRequestDto } from '@api/dto/request/calendar/get-calendar-events.dto';
import { CalendarEventsResponseDto } from '@api/dto/response/calendar/calendar-event.dto';
import { UserType } from '@core/calendar/interfaces/calendar-slot.interface';

@ApiTags('Calendar')
@Controller(`${ApiPrefix}/calendar`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CalendarController {
  constructor(
    private readonly getCalendarEventsUseCase: GetCalendarEventsUseCase,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get calendar events for a user',
    description: `
      Retrieve all calendar events (booked/completed/cancelled) for a user within a date range.
      Suitable for calendar view rendering.
      
      Query Parameters:
      - userId (required): User ID
      - userType (required): User type (mentor/student/counselor)
      - startDate (optional): Start date (ISO 8601 format, default: now)
      - endDate (optional): End date (ISO 8601 format, default: 90 days from start, max 90 days range)
      
      Returns:
      - List of calendar events with title, time, duration, meeting URL, and other party name
    `,
  })
  @ApiOkResponse({
    description: 'Calendar events retrieved successfully',
    type: CalendarEventsResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request parameters or date range exceeds 90 days',
  })
  async getCalendarEvents(
    @Query() dto: GetCalendarEventsRequestDto,
  ): Promise<CalendarEventsResponseDto> {
    const events = await this.getCalendarEventsUseCase.execute({
      userId: dto.userId,
      userType: dto.userType as UserType,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
    });

    return { events };
  }
}
