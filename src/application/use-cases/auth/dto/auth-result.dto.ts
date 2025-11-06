/**
 * Application Layer - Auth Result DTO
 * 职责：Application 层返回的业务数据结构
 * 特点：不包含前端特定字段，可被多个 BFF 复用
 */
export interface AuthResultDto {
  accessToken: string;
  user: {
    id: string;
    email: string;
    nickname?: string;
    cnNickname?: string;
    status: string;
  };
}
