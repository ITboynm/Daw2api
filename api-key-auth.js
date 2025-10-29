import { findApiKeyByKey } from './data-store.js';
import { getTodayUsage } from './usage-tracker.js';
import { getAdminCredentials } from './config.js';
import { logInfo, logError } from './logger.js';

/**
 * API Key 认证中间件
 * 验证请求中的 API Key 是否有效
 */
export function apiKeyAuth(req, res, next) {
  // 从 Authorization header 或 x-api-key header 获取 API Key
  let apiKey = null;
  
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    apiKey = authHeader.substring(7);
  } else if (req.headers['x-api-key']) {
    apiKey = req.headers['x-api-key'];
  }
  
  // 检查是否提供了 API Key
  if (!apiKey) {
    logError('API Key missing in request');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'API Key is required. Please provide it via Authorization header (Bearer token) or x-api-key header.'
    });
  }
  
  // 验证 API Key
  const keyData = findApiKeyByKey(apiKey);
  
  if (!keyData) {
    logError('Invalid API Key attempted');
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API Key'
    });
  }
  
  if (!keyData.enabled) {
    logError(`Disabled API Key attempted: ${keyData.name}`);
    return res.status(403).json({
      error: 'Forbidden',
      message: 'This API Key has been disabled'
    });
  }
  
  // 检查速率限制
  if (keyData.rateLimit > 0) {
    const todayUsage = getTodayUsage(keyData.id);
    if (todayUsage.totalRequests >= keyData.rateLimit) {
      logError(`Rate limit exceeded for API Key: ${keyData.name}`);
      return res.status(429).json({
        error: 'Rate Limit Exceeded',
        message: `Daily rate limit of ${keyData.rateLimit} requests exceeded`,
        usage: {
          today: todayUsage.totalRequests,
          limit: keyData.rateLimit
        }
      });
    }
  }
  
  // 将 API Key 信息附加到请求对象，供后续使用
  req.apiKeyData = keyData;
  
  logInfo(`API request authenticated: ${keyData.name || keyData.id}`);
  next();
}

// 简单的 token 存储（生产环境建议使用 Redis 或数据库）
const activeSessions = new Map();

/**
 * 生成随机 token
 */
function generateToken() {
  return Buffer.from(Date.now() + Math.random().toString()).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * 管理后台登录
 */
export function adminLogin(req, res) {
  const { username, password, rememberMe } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({
      error: 'Bad Request',
      message: '请输入用户名和密码'
    });
  }
  
  const adminCreds = getAdminCredentials();
  
  if (username === adminCreds.username && password === adminCreds.password) {
    const token = generateToken();
    const expiresIn = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 7天或1天
    const expiresAt = Date.now() + expiresIn;
    
    activeSessions.set(token, {
      username,
      expiresAt,
      createdAt: Date.now()
    });
    
    logInfo(`Admin logged in: ${username}`);
    
    return res.json({
      success: true,
      token,
      expiresIn
    });
  } else {
    logError(`Failed login attempt for user: ${username}`);
    return res.status(401).json({
      error: 'Unauthorized',
      message: '用户名或密码错误'
    });
  }
}

/**
 * 验证 token
 */
export function verifyToken(req, res) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token required'
    });
  }
  
  const token = authHeader.substring(7);
  const session = activeSessions.get(token);
  
  if (!session) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
  
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token expired'
    });
  }
  
  return res.json({
    success: true,
    username: session.username
  });
}

/**
 * 登出
 */
export function adminLogout(req, res) {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    activeSessions.delete(token);
  }
  
  return res.json({
    success: true,
    message: 'Logged out successfully'
  });
}

/**
 * 管理后台认证中间件（使用 Token）
 */
export function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    });
  }
  
  const token = authHeader.substring(7);
  const session = activeSessions.get(token);
  
  if (!session) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    });
  }
  
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Token expired'
    });
  }
  
  req.admin = session;
  next();
}

// 定期清理过期 session
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of activeSessions.entries()) {
    if (now > session.expiresAt) {
      activeSessions.delete(token);
    }
  }
}, 60 * 60 * 1000); // 每小时清理一次

