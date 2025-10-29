import { addUsageLog, getUsageStats } from './data-store.js';
import { logDebug } from './logger.js';

/**
 * 记录 API 使用情况（简化版 - 只记录调用次数）
 * @param {object} params - 使用参数
 * @param {string} params.apiKeyId - API Key ID
 * @param {string} params.apiKeyName - API Key 名称
 * @param {string} params.model - 模型名称
 * @param {string} params.endpoint - 请求端点
 * @param {number} params.responseTime - 响应时间（ms）
 * @param {boolean} params.success - 是否成功
 * @param {string} params.error - 错误信息（如果有）
 */
export function trackUsage({
  apiKeyId,
  apiKeyName,
  model,
  endpoint,
  responseTime,
  success = true,
  error = null
}) {
  const log = {
    apiKeyId,
    apiKeyName,
    model,
    endpoint,
    responseTime,
    success,
    error
  };
  
  addUsageLog(log);
  
  logDebug('Usage tracked', {
    apiKey: apiKeyName,
    model,
    success: success ? 'yes' : 'no',
    time: `${responseTime}ms`
  });
}

/**
 * 获取指定 API Key 的使用统计
 * @param {string} apiKeyId - API Key ID
 * @param {string} startDate - 开始日期（可选）
 * @param {string} endDate - 结束日期（可选）
 * @returns {object} 统计数据
 */
export function getApiKeyUsage(apiKeyId, startDate = null, endDate = null) {
  return getUsageStats(apiKeyId, startDate, endDate);
}

/**
 * 获取所有使用统计
 * @param {string} startDate - 开始日期（可选）
 * @param {string} endDate - 结束日期（可选）
 * @returns {object} 统计数据
 */
export function getAllUsage(startDate = null, endDate = null) {
  return getUsageStats(null, startDate, endDate);
}

/**
 * 获取今日使用统计
 * @param {string} apiKeyId - API Key ID（可选）
 * @returns {object} 今日统计数据
 */
export function getTodayUsage(apiKeyId = null) {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  return getUsageStats(apiKeyId, today, tomorrow);
}

/**
 * 获取本月使用统计
 * @param {string} apiKeyId - API Key ID（可选）
 * @returns {object} 本月统计数据
 */
export function getMonthUsage(apiKeyId = null) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
  return getUsageStats(apiKeyId, startOfMonth, endOfMonth);
}

