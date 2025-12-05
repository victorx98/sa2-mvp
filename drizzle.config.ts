import type { Config } from 'drizzle-kit';

// 增强的数据库URL配置，添加更多连接参数以解决连接问题
export const createEnhancedDatabaseUrl = (): string => {
  // 从环境变量获取基础URL，必须设置 DATABASE_URL [Get base URL from environment variable, DATABASE_URL must be set]
  const baseUrl = process.env.DATABASE_URL;
  
  if (!baseUrl) {
    throw new Error(
      "DATABASE_URL environment variable is required. Please set it in your .env file.",
    );
  }
  
  // 添加全面的连接参数，包括重试逻辑和连接池设置
  const connectionParams = [
    'options=--search_path%3Dpublic',
    'connect_timeout=180', // 增加到180秒，适应WSL2环境
    'statement_timeout=300000', // 增加到300秒
    'idle_in_transaction_session_timeout=600000', // 增加到600秒
    'keepalives=1', // 启用TCP keepalive
    'keepalives_idle=60', // TCP keepalive空闲时间
    'keepalives_interval=10', // TCP keepalive间隔
    'keepalives_count=10', // TCP keepalive重试次数
    'application_name=sa2-mvp-migration', // 设置应用名称以便调试
    'tcp_user_timeout=30000', // TCP用户超时，30秒
  ].join('&');
  
  return `${baseUrl}?${connectionParams}`;
};

export default {
  schema: './src/infrastructure/database/schema/**/*.schema.ts',
  out: './src/infrastructure/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // Use lazy getter to defer validation until drizzle-kit needs it [使用延迟getter将验证推迟到drizzle-kit需要时]
    // This prevents blocking NestJS startup when DATABASE_URL is in a different env file [这防止DATABASE_URL在不同env文件时阻塞NestJS启动]
    // Drizzle-kit will still fail fast when actually used [实际使用时drizzle-kit仍会快速失败]
    get url() {
      const url = createEnhancedDatabaseUrl();
      // Log for debugging when drizzle-kit actually uses this config [当drizzle-kit实际使用此配置时记录以便调试]
      console.log('Drizzle-kit config loaded, DATABASE_URL validated');
      return url;
    }
  },
  breakpoints: true,
  // 移除不支持的migrations配置
} satisfies Config;
