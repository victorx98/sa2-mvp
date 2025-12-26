import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiOkResponse, ApiBearerAuth, ApiParam } from "@nestjs/swagger";
import { GetUserUseCase } from "@application/queries/identity/use-cases/get-user.use-case";
import { User } from "@domains/identity/user/user-interface";
import { Gender } from "@shared/types/identity-enums";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { CurrentUser } from "@shared/decorators/current-user.decorator";
import { ApiPrefix } from "@api/api.constants";
import { UserResponseDto } from "@api/dto/response/user-response.dto";
import { plainToInstance } from "class-transformer";
import { trace } from "@opentelemetry/api";

@ApiTags("Users")
@Controller(`${ApiPrefix}/users`)
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UserController {
  constructor(
    private readonly getUserUseCase: GetUserUseCase,
  ) {}

  @Get("me")
  @ApiOperation({ summary: "Get current authenticated user" })
  @ApiOkResponse({
    description: "User retrieved successfully",
    type: UserResponseDto,
  })
  async getCurrentUser(@CurrentUser() user: User): Promise<UserResponseDto> {
    const tracer = trace.getTracer('test');
    const span = tracer.startSpan('manual-test');
    span.end();
    return this.toUserResponseDto(user);
  }

  @Get(":id")
  @ApiOperation({ summary: "Get user by ID" })
  @ApiParam({
    name: "id",
    description: "User ID",
    type: String,
  })
  @ApiOkResponse({
    description: "User retrieved successfully",
    type: UserResponseDto,
  })
  async getUserById(@Param("id") id: string): Promise<UserResponseDto> {
    const user = await this.getUserUseCase.getUserById(id);
    const userWithCorrectGender = {
      ...user,
      gender: user.gender as Gender,
    } as User;
    return this.toUserResponseDto(userWithCorrectGender);
  }

  private toUserResponseDto(user: User): UserResponseDto {
    return plainToInstance(
      UserResponseDto,
      {
        ...user,
        roles: user.roles ?? [],
      },
      { enableImplicitConversion: false },
    );
  }
}
