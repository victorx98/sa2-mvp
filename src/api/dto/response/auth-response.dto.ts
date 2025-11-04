export class AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    nickname?: string;
    cnNickname?: string;
    status?: string;
  };
}
