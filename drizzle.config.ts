import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config();

// 增强的数据库URL配置，添加更多连接参数以解决连接问题
const createEnhancedDatabaseUrl = (): string => {
  // 直接从环境变量解析数据库连接参数
  const dbParams = {
    user: process.env.POSTGRES_USER || 'postgres.gexkpohuuqewswljbguf',
    password: process.env.POSTGRES_PASSWORD || 'Abc@123456',
    host: process.env.POSTGRES_HOST || 'aws-1-us-east-2.pooler.supabase.com',
    port: parseInt(process.env.POSTGRES_PORT || '6543', 10),
    database: process.env.POSTGRES_DATABASE || 'postgres',
  };
  
  // 构建包含所有参数的连接字符串
  const baseUrl = `postgresql://${encodeURIComponent(dbParams.user)}:${encodeURIComponent(dbParams.password)}@${dbParams.host}:${dbParams.port}/${dbParams.database}`;
  
  // 添加全面的连接参数，包括重试逻辑和连接池设置
  const connectionParams = [
    'options=--search_path%3Dpublic',
    'connect_timeout=120', // 增加到120秒
    'statement_timeout=300000', // 增加到300秒
    'idle_in_transaction_session_timeout=600000', // 增加到600秒
    'keepalives=1', // 启用TCP keepalive
    'keepalives_idle=60', // TCP keepalive空闲时间
    'keepalives_interval=10', // TCP keepalive间隔
    'keepalives_count=10', // TCP keepalive重试次数
    'application_name=sa2-mvp-migration', // 设置应用名称以便调试
  ].join('&');
  
  return `${baseUrl}?${connectionParams}`;
};

export default {
  schema: './src/infrastructure/database/schema/**/*.schema.ts',
  out: './src/infrastructure/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: createEnhancedDatabaseUrl()
  },
  breakpoints: true,
  // 移除不支持的migrations配置
} satisfies Config;
