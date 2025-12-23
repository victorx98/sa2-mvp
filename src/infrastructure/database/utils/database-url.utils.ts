/**
 * 增强的数据库URL配置工具
 * 添加更多连接参数以解决连接问题
 */
export const createEnhancedDatabaseUrl = (): string => {
  // 从环境变量获取基础URL，默认使用Supabase连接字符串
  const baseUrl = process.env.DATABASE_URL;
  
  if (!baseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  // 如果 URL 已经包含查询参数，需要合并而不是覆盖
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch (error) {
    throw new Error(`Invalid DATABASE_URL format: ${error.message}. URL: ${baseUrl.substring(0, 50)}...`);
  }
  
  // 添加全面的连接参数，包括重试逻辑和连接池设置
  const connectionParams: Record<string, string> = {
    'options': '--search_path=public',
    'connect_timeout': '120', // 增加到120秒
    'statement_timeout': '300000', // 增加到300秒
    'idle_in_transaction_session_timeout': '600000', // 增加到600秒
    'keepalives': '1', // 启用TCP keepalive
    'keepalives_idle': '60', // TCP keepalive空闲时间
    'keepalives_interval': '10', // TCP keepalive间隔
    'keepalives_count': '10', // TCP keepalive重试次数
    'application_name': 'sa2-mvp', // 设置应用名称以便调试
  };
  
  // 合并现有的查询参数（不覆盖已存在的参数）
  Object.entries(connectionParams).forEach(([key, value]) => {
    if (!url.searchParams.has(key)) {
      url.searchParams.set(key, value);
    }
  });
  
  // 确保返回的URL格式正确（移除默认端口5432如果存在）
  const result = url.toString();
  
  return result;
};
