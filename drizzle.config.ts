import type { Config } from 'drizzle-kit';

// 增强的数据库URL配置，添加更多连接参数以解决连接问题
export const createEnhancedDatabaseUrl = (): string => {
  // 从环境变量获取基础URL，必须设置 DATABASE_URL [Get base URL from environment variable, DATABASE_URL must be set]
  const baseUrl = process.env.DATABASE_URL;
  
  if (!baseUrl) {
    const errorMessage = [
      "DATABASE_URL environment variable is required for drizzle-kit commands.",
      "",
      "This error occurs when running drizzle-kit commands (db:generate, db:migrate, db:studio, etc.).",
      "The DATABASE_URL is not available in the current environment.",
      "",
      "Possible solutions:",
      "  1. Set DATABASE_URL in your .env file in the project root",
      "  2. Export DATABASE_URL as an environment variable before running the command",
      "  3. If using a different env file, ensure it's loaded before running drizzle-kit",
      "  4. Check that your .env file is in the correct location and contains DATABASE_URL",
      "",
      "Note: This validation is deferred until drizzle-kit actually needs the database connection.",
      "This prevents blocking NestJS startup when DATABASE_URL is in a different env file.",
    ].join("\n");
    
    throw new Error(errorMessage);
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
    // When drizzle-kit accesses this getter, validation occurs and will throw if DATABASE_URL is missing [当drizzle-kit访问此getter时，验证发生，如果DATABASE_URL缺失将抛出错误]
    get url() {
      try {
        const url = createEnhancedDatabaseUrl();
        // Log for debugging when drizzle-kit actually uses this config [当drizzle-kit实际使用此配置时记录以便调试]
        console.log('Drizzle-kit config loaded, DATABASE_URL validated');
        return url;
      } catch (error) {
        // Re-throw with additional context that this is a drizzle-kit configuration issue [重新抛出错误，添加这是drizzle-kit配置问题的上下文]
        if (error instanceof Error) {
          const enhancedError = new Error(
            `[Drizzle-kit Configuration Error] ${error.message}`
          );
          enhancedError.stack = error.stack;
          throw enhancedError;
        }
        throw error;
      }
    }
  },
  breakpoints: true,
  // 移除不支持的migrations配置
} satisfies Config;
