import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { ApiPrefix } from "@api/api.constants";
import { MentorListQuery } from "@application/queries/mentor/mentor-list.query";
import { MentorSummaryResponseDto } from "@api/dto/response/mentor-response.dto";
import { plainToInstance } from "class-transformer";

@ApiTags("Mentors")
@Controller(`${ApiPrefix}/mentors`)
@UseGuards(JwtAuthGuard)
export class MentorsController {
  constructor(private readonly mentorListQuery: MentorListQuery) {}

  @Get("/find")
  @ApiOperation({ summary: "find mentor" })
  @ApiOkResponse({
    description: "Mentor results retrieved successfully",
    type: MentorSummaryResponseDto,
    isArray: true,
  })
  async findMentors(
    @Query("text") text?: string,
    @Query("studentId") studentId?: string,
  ): Promise<MentorSummaryResponseDto[]> {
    const mentors = await this.mentorListQuery.execute(text, studentId);
    return plainToInstance(MentorSummaryResponseDto, mentors, {
      enableImplicitConversion: false,
    });
  }

  @Get("/list")
  @ApiOperation({ summary: "list mentor total info" })
  @ApiOkResponse({
    description: "Mentors retrieved successfully",
    type: MentorSummaryResponseDto,
    isArray: true,
  })
  async getMentorList(): Promise<MentorSummaryResponseDto[]> {
    return [];
  }
}

