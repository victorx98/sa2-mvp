import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { ApiPrefix } from "@api/api.constants";
import { MentorListUseCase } from "@application/queries/identity/use-cases/mentor-list.use-case";
import { MentorSummaryResponseDto } from "@api/dto/response/mentor-response.dto";
import { plainToInstance } from "class-transformer";

@ApiTags("Mentors")
@Controller(`${ApiPrefix}/mentors`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MentorsController {
  constructor(private readonly mentorListQuery: MentorListUseCase) { }

  @Get("find")
  @ApiOperation({ summary: "find mentor" })
  @ApiQuery({
    name: "text",
    required: false,
    description: "Search keyword to filter mentors",
    type: String,
  })
  @ApiQuery({
    name: "studentId",
    required: false,
    description: "Filter mentors by student ID",
    type: String,
  })
  @ApiOkResponse({
    description: "Mentor results retrieved successfully",
    type: MentorSummaryResponseDto,
    isArray: true,
  })
  async findMentors(
    @Query("text") text?: string,
    @Query("studentId") studentId?: string,
  ): Promise<MentorSummaryResponseDto[]> {
    const mentors = await this.mentorListQuery.listMentors({ keyword: text });
    return plainToInstance(MentorSummaryResponseDto, mentors.data, {
      excludeExtraneousValues: true,
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

