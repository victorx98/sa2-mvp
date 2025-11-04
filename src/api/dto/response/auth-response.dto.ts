export class AuthResponseDto {
  accessToken: string;
  user: {
    id: string;
    account: string;
    email: string;
    nickname?: string;
    cnNickname?: string;
    status?: string;
  };
}
