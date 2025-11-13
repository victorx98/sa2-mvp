import { User } from "@domains/identity/user/user-interface";
import { UserResponseDto } from "@api/dto/response/user-response.dto";

export class UserTransformer {
  static toResponseDto(user: User): UserResponseDto {
    return {
      id: user.id,
      gender: user.gender,
      nickname: user.nickname,
      cnNickname: user.cnNickname,
      status: user.status,
      email: user.email,
      country: user.country,
      createdTime: user.createdTime,
      modifiedTime: user.modifiedTime,
    };
  }

  static toResponseDtoList(users: User[]): UserResponseDto[] {
    return users.map((user) => this.toResponseDto(user));
  }
}
