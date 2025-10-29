import { getConfig } from './config.js';
import { logDebug } from './logger.js';

/**
 * 检测请求是否来自 Claude Code 客户端
 * 参考: claude-relay-service 的实现
 * 
 * @param {Object} req - Express 请求对象
 * @returns {boolean} 如果是 Claude Code 客户端返回 true
 */
export function isClaudeCodeClient(req) {
  try {
    const userAgent = req.headers['user-agent'] || '';
    
    // 1. 检查 User-Agent 是否匹配 Claude Code 模式
    // 格式: claude-cli/1.0.0 或类似
    const claudeCodePattern = /^claude-cli\/\d+\.\d+\.\d+/i;
    
    if (!claudeCodePattern.test(userAgent)) {
      return false;
    }
    
    logDebug(`Detected Claude Code User-Agent: ${userAgent}`);
    
    // 2. 检查必需的 Claude Code 头部
    const xApp = req.headers['x-app'];
    const anthropicBeta = req.headers['anthropic-beta'];
    const anthropicVersion = req.headers['anthropic-version'];
    
    // 至少需要有这些头部中的一个
    if (!xApp && !anthropicBeta && !anthropicVersion) {
      logDebug('User-Agent matches but missing Claude Code headers');
      return false;
    }
    
    // 3. 检查 body 中的 metadata.user_id（如果存在）
    if (req.body && req.body.metadata && req.body.metadata.user_id) {
      const userId = req.body.metadata.user_id;
      // Claude Code 格式: user_{64位字符串}_account__session_{UUID}
      const userIdPattern = /^user_[a-fA-F0-9]{64}_account__session_[\w-]+$/;
      
      if (userIdPattern.test(userId)) {
        logDebug(`Confirmed Claude Code client via user_id: ${userId.substring(0, 20)}...`);
        return true;
      }
    }
    
    // User-Agent 匹配且有相关头部，认为是 Claude Code
    logDebug('Detected Claude Code client via User-Agent and headers');
    return true;
    
  } catch (error) {
    logDebug('Error detecting Claude Code client:', error);
    return false;
  }
}

/**
 * 检查是否应该拦截 Claude Code 客户端
 * 
 * @param {Object} req - Express 请求对象
 * @returns {boolean} 如果应该拦截返回 true
 */
export function shouldBlockClaudeCode(req) {
  const config = getConfig();
  
  // 如果配置关闭拦截，直接返回 false
  if (!config.blockClaudeCode) {
    return false;
  }
  
  // 检测是否是 Claude Code 客户端
  return isClaudeCodeClient(req);
}

/**
 * 获取 Claude Code 拦截错误消息
 * 
 * @returns {Object} 错误响应对象
 */
export function getClaudeCodeBlockedError() {
  return {
    type: 'error',
    error: {
      type: 'permission_error',
      message: '⚠️ 请勿在 Claude Code 客户端使用本服务\n\n' +
               'Please do not use this service with Claude Code client.\n\n' +
               '本服务不支持 Claude Code 客户端访问。\n' +
               'This service does not support access from Claude Code client.\n\n' +
               '如需使用，请通过其他方式调用 API。\n' +
               'Please use other methods to call the API if needed.'
    }
  };
}

