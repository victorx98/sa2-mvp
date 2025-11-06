import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { UserQueryService } from "@application/queries/user-query.service";
import { UserResponseDto } from "@api/dto/response/user-response.dto";
import { UserTransformer } from "@api/transformers/user.transformer";
import { JwtAuthGuard } from "@shared/guards/jwt-auth.guard";
import { CurrentUser } from "@shared/decorators/current-user.decorator";

@Controller("users")
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userQueryService: UserQueryService) {}

  @Get("me")
  async getCurrentUser(@CurrentUser() user: any): Promise<UserResponseDto> {
    const userData = await this.userQueryService.getUserById(user.userId);
    return UserTransformer.toResponseDto(userData);
  }

  @Get(":id")
  async getUserById(@Param("id") id: string): Promise<UserResponseDto> {
    const userData = await this.userQueryService.getUserById(id);
    return UserTransformer.toResponseDto(userData);
  }
}
