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

  @Get()
  @ApiOperation({ summary: "Get mentor list" })
  @ApiOkResponse({
    description: "Mentors retrieved successfully",
    type: MentorSummaryResponseDto,
    isArray: true,
  })
  async getMentors(
    @Query("query") search?: string,
  ): Promise<MentorSummaryResponseDto[]> {
    const mentors = await this.mentorListQuery.execute(search);
    return plainToInstance(MentorSummaryResponseDto, mentors, {
      enableImplicitConversion: false,
    });
  }
}

