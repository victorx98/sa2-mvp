/**
 * Application Layer - Auth Result DTO
 * 职责：Application 层返回的业务数据结构
 * 特点：不包含前端特定字段，可被多个 BFF 复用
 */
export interface AuthResultDto {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    email: string;
    nameEn?: string;
    nameZh?: string;
    status?: string;
    roles: string[];
  };
}
