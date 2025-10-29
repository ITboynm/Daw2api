import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const FACTORY_KEYS_FILE = path.join(DATA_DIR, 'factory-keys.json');
const API_KEYS_FILE = path.join(DATA_DIR, 'api-keys.json');
const USAGE_LOG_FILE = path.join(DATA_DIR, 'usage-log.json');
const ERROR_LOG_FILE = path.join(DATA_DIR, 'error-log.json');

// 确保数据目录存在
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// Factory Keys 管理
export function loadFactoryKeys() {
  ensureDataDir();
  if (!fs.existsSync(FACTORY_KEYS_FILE)) {
    const defaultData = {
      keys: [],
      currentIndex: 0
    };
    fs.writeFileSync(FACTORY_KEYS_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  const data = fs.readFileSync(FACTORY_KEYS_FILE, 'utf-8');
  return JSON.parse(data);
}

export function saveFactoryKeys(data) {
  ensureDataDir();
  fs.writeFileSync(FACTORY_KEYS_FILE, JSON.stringify(data, null, 2));
}

export function addFactoryKey(key, name = '') {
  const data = loadFactoryKeys();
  const newKey = {
    id: Date.now().toString(),
    key: key,
    name: name,
    failCount: 0,
    lastFailTime: null,
    totalRequests: 0,
    successRequests: 0,
    status: 'active', // active, disabled, failed
    createdAt: new Date().toISOString()
  };
  data.keys.push(newKey);
  saveFactoryKeys(data);
  return newKey;
}

export function updateFactoryKey(id, updates) {
  const data = loadFactoryKeys();
  const index = data.keys.findIndex(k => k.id === id);
  if (index !== -1) {
    data.keys[index] = { ...data.keys[index], ...updates };
    saveFactoryKeys(data);
    return data.keys[index];
  }
  return null;
}

export function deleteFactoryKey(id) {
  const data = loadFactoryKeys();
  data.keys = data.keys.filter(k => k.id !== id);
  saveFactoryKeys(data);
}

// API Keys 管理
export function loadApiKeys() {
  ensureDataDir();
  if (!fs.existsSync(API_KEYS_FILE)) {
    const defaultData = { keys: [] };
    fs.writeFileSync(API_KEYS_FILE, JSON.stringify(defaultData, null, 2));
    return defaultData;
  }
  const data = fs.readFileSync(API_KEYS_FILE, 'utf-8');
  return JSON.parse(data);
}

export function saveApiKeys(data) {
  ensureDataDir();
  fs.writeFileSync(API_KEYS_FILE, JSON.stringify(data, null, 2));
}

export function addApiKey(key, name = '', rateLimit = 0) {
  const data = loadApiKeys();
  const newKey = {
    id: Date.now().toString(),
    key: key,
    name: name,
    rateLimit: rateLimit, // 每天请求限制，0为不限制
    enabled: true,
    createdAt: new Date().toISOString()
  };
  data.keys.push(newKey);
  saveApiKeys(data);
  return newKey;
}

export function updateApiKey(id, updates) {
  const data = loadApiKeys();
  const index = data.keys.findIndex(k => k.id === id);
  if (index !== -1) {
    data.keys[index] = { ...data.keys[index], ...updates };
    saveApiKeys(data);
    return data.keys[index];
  }
  return null;
}

export function deleteApiKey(id) {
  const data = loadApiKeys();
  data.keys = data.keys.filter(k => k.id !== id);
  saveApiKeys(data);
}

export function findApiKeyByKey(key) {
  const data = loadApiKeys();
  return data.keys.find(k => k.key === key && k.enabled);
}

// Usage Log 管理
export function loadUsageLogs(limit = 1000) {
  ensureDataDir();
  if (!fs.existsSync(USAGE_LOG_FILE)) {
    return [];
  }
  const data = fs.readFileSync(USAGE_LOG_FILE, 'utf-8');
  const logs = JSON.parse(data);
  return logs.slice(-limit); // 返回最新的 N 条
}

export function addUsageLog(log) {
  ensureDataDir();
  let logs = [];
  if (fs.existsSync(USAGE_LOG_FILE)) {
    const data = fs.readFileSync(USAGE_LOG_FILE, 'utf-8');
    logs = JSON.parse(data);
  }
  
  logs.push({
    ...log,
    timestamp: new Date().toISOString()
  });
  
  // 只保留最近 10000 条记录
  if (logs.length > 10000) {
    logs = logs.slice(-10000);
  }
  
  fs.writeFileSync(USAGE_LOG_FILE, JSON.stringify(logs, null, 2));
}

// Error Log 管理
export function loadErrorLogs(limit = 500) {
  ensureDataDir();
  if (!fs.existsSync(ERROR_LOG_FILE)) {
    return [];
  }
  const data = fs.readFileSync(ERROR_LOG_FILE, 'utf-8');
  const logs = JSON.parse(data);
  return logs.slice(-limit);
}

export function addErrorLog(error) {
  ensureDataDir();
  let logs = [];
  if (fs.existsSync(ERROR_LOG_FILE)) {
    const data = fs.readFileSync(ERROR_LOG_FILE, 'utf-8');
    logs = JSON.parse(data);
  }
  
  logs.push({
    ...error,
    timestamp: new Date().toISOString()
  });
  
  // 只保留最近 5000 条记录
  if (logs.length > 5000) {
    logs = logs.slice(-5000);
  }
  
  fs.writeFileSync(ERROR_LOG_FILE, JSON.stringify(logs, null, 2));
}

// 统计相关（简化版 - 只统计调用次数）
export function getUsageStats(apiKeyId = null, startDate = null, endDate = null) {
  const logs = loadUsageLogs();
  
  let filteredLogs = logs;
  
  if (apiKeyId) {
    filteredLogs = filteredLogs.filter(log => log.apiKeyId === apiKeyId);
  }
  
  if (startDate) {
    filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= new Date(startDate));
  }
  
  if (endDate) {
    filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= new Date(endDate));
  }
  
  const stats = {
    totalRequests: filteredLogs.length,
    successRequests: 0,
    failedRequests: 0,
    modelUsage: {},
    dailyUsage: {}
  };
  
  filteredLogs.forEach(log => {
    // 统计成功/失败次数
    if (log.success) {
      stats.successRequests++;
    } else {
      stats.failedRequests++;
    }
    
    // 按模型统计
    if (!stats.modelUsage[log.model]) {
      stats.modelUsage[log.model] = {
        requests: 0,
        success: 0,
        failed: 0
      };
    }
    stats.modelUsage[log.model].requests++;
    if (log.success) {
      stats.modelUsage[log.model].success++;
    } else {
      stats.modelUsage[log.model].failed++;
    }
    
    // 按日期统计
    const date = log.timestamp.split('T')[0];
    if (!stats.dailyUsage[date]) {
      stats.dailyUsage[date] = {
        requests: 0,
        success: 0,
        failed: 0
      };
    }
    stats.dailyUsage[date].requests++;
    if (log.success) {
      stats.dailyUsage[date].success++;
    } else {
      stats.dailyUsage[date].failed++;
    }
  });
  
  return stats;
}

