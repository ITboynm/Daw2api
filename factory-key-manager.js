import { loadFactoryKeys, saveFactoryKeys, updateFactoryKey, addErrorLog } from './data-store.js';
import { logInfo, logError, logDebug } from './logger.js';

const MAX_RETRIES_PER_PROXY = 3; // 每个代理重试3次
const MAX_PROXY_ATTEMPTS = 3; // 尝试3个不同的代理

class FactoryKeyManager {
  constructor() {
    this.data = null;
    this.load();
    // 记录当前key的失败状态 { keyId: { proxyAttempts: 0, currentProxyRetries: 0, lastProxyId: null } }
    this.failureState = new Map();
  }

  load() {
    this.data = loadFactoryKeys();
    logDebug(`Loaded ${this.data.keys.length} factory keys`);
  }

  reload() {
    this.load();
  }

  // 获取当前可用的 key
  getCurrentKey() {
    if (!this.data || this.data.keys.length === 0) {
      return null;
    }

    // 获取所有活跃的 key
    const activeKeys = this.data.keys.filter(k => k.status === 'active');

    if (activeKeys.length === 0) {
      // 如果没有活跃的 key，尝试重置所有 key 的失败次数
      logError('All factory keys have failed, resetting all keys');
      this.resetAllFailCounts();
      return this.getCurrentKey();
    }

    // 使用轮询方式选择 key
    const index = this.data.currentIndex % activeKeys.length;
    const key = activeKeys[index];
    
    logDebug(`Using factory key: ${key.name || key.id} (${index + 1}/${activeKeys.length})`);
    return key;
  }

  // 记录成功请求
  recordSuccess(keyId, proxyId = null) {
    const key = this.data.keys.find(k => k.id === keyId);
    if (key) {
      key.totalRequests++;
      key.successRequests++;
      saveFactoryKeys(this.data);
      
      // 成功后重置该key的失败状态
      this.failureState.delete(keyId);
      
      logDebug(`Factory key ${key.name || key.id} success (proxy: ${proxyId || 'direct'})`);
    }
  }

  // 记录失败请求并决定是切换代理还是切换key
  // 返回值：{ action: 'retry_proxy' | 'switch_key' | 'failed', shouldSwitchProxy: boolean }
  recordFailure(keyId, proxyId, error, hasProxies = false) {
    const key = this.data.keys.find(k => k.id === keyId);
    if (!key) {
      return { action: 'failed', shouldSwitchProxy: false };
    }

    key.totalRequests++;
    
    // 如果没有配置代理，直接按失败次数判断
    if (!hasProxies) {
      if (!key.failCount) key.failCount = 0;
      key.failCount++;
      
      logError(`Factory key ${key.name || key.id} failed (no proxy, ${key.failCount}/3)`, error);
      
      addErrorLog({
        type: 'factory_key_failure',
        keyId: keyId,
        keyName: key.name,
        failCount: key.failCount,
        error: error?.message || String(error)
      });
      
      if (key.failCount >= 3) {
        key.status = 'failed';
        key.lastFailTime = new Date().toISOString();
        saveFactoryKeys(this.data);
        
        logError(`Factory key ${key.name || key.id} has been disabled after 3 consecutive failures`);
        this.switchToNextKey();
        return { action: 'switch_key', shouldSwitchProxy: false };
      }
      
      saveFactoryKeys(this.data);
      return { action: 'retry_proxy', shouldSwitchProxy: false };
    }
    
    // 有代理配置，使用代理轮询重试逻辑
    // 获取或初始化该key的失败状态
    if (!this.failureState.has(keyId)) {
      this.failureState.set(keyId, {
        proxyAttempts: 0,
        currentProxyRetries: 0,
        lastProxyId: null
      });
    }
    
    const state = this.failureState.get(keyId);
    
    // 如果是同一个代理，增加该代理的重试次数
    if (state.lastProxyId === proxyId) {
      state.currentProxyRetries++;
    } else {
      // 换了一个新代理，重置当前代理重试次数，增加代理尝试次数
      state.lastProxyId = proxyId;
      state.currentProxyRetries = 1;
      state.proxyAttempts++;
    }
    
    logError(
      `Factory key ${key.name || key.id} failed (proxy: ${proxyId || 'direct'}, ` +
      `retry ${state.currentProxyRetries}/${MAX_RETRIES_PER_PROXY}, ` +
      `proxy attempt ${state.proxyAttempts}/${MAX_PROXY_ATTEMPTS})`,
      error
    );
    
    // 记录错误日志
    addErrorLog({
      type: 'factory_key_failure',
      keyId: keyId,
      keyName: key.name,
      proxyId: proxyId,
      proxyAttempts: state.proxyAttempts,
      currentProxyRetries: state.currentProxyRetries,
      error: error?.message || String(error)
    });
    
    saveFactoryKeys(this.data);
    
    // 判断下一步操作
    if (state.currentProxyRetries < MAX_RETRIES_PER_PROXY) {
      // 当前代理还没重试够3次，继续用这个代理重试
      return { action: 'retry_proxy', shouldSwitchProxy: false };
    } else if (state.proxyAttempts < MAX_PROXY_ATTEMPTS) {
      // 当前代理已经重试了3次，但还没试完3个代理，切换代理
      state.currentProxyRetries = 0; // 重置当前代理重试次数
      return { action: 'retry_proxy', shouldSwitchProxy: true };
    } else {
      // 已经试了3个代理，每个代理3次，总共9次失败，该key失效
      key.status = 'failed';
      key.lastFailTime = new Date().toISOString();
      this.failureState.delete(keyId);
      saveFactoryKeys(this.data);
      
      logError(`Factory key ${key.name || key.id} has been disabled after ${MAX_PROXY_ATTEMPTS} proxies × ${MAX_RETRIES_PER_PROXY} retries`);
      
      // 切换到下一个 key
      this.switchToNextKey();
      return { action: 'switch_key', shouldSwitchProxy: false };
    }
  }

  // 切换到下一个可用的 key
  switchToNextKey() {
    const activeKeys = this.data.keys.filter(k => k.status === 'active'
    );

    if (activeKeys.length === 0) {
      logError('No active factory keys available');
      return null;
    }

    this.data.currentIndex = (this.data.currentIndex + 1) % activeKeys.length;
    saveFactoryKeys(this.data);
    
    const nextKey = this.getCurrentKey();
    logInfo(`Switched to factory key: ${nextKey?.name || nextKey?.id}`);
    return nextKey;
  }

  // 重置所有 key 的失败计数
  resetAllFailCounts() {
    this.data.keys.forEach(key => {
      if (key.status === 'failed') {
        key.status = 'active';
      }
      key.failCount = 0;
      key.lastFailTime = null;
    });
    saveFactoryKeys(this.data);
    logInfo('All factory keys fail counts have been reset');
  }

  // 手动禁用/启用 key
  setKeyStatus(keyId, status) {
    const key = this.data.keys.find(k => k.id === keyId);
    if (key) {
      key.status = status;
      if (status === 'active') {
        key.failCount = 0;
        key.lastFailTime = null;
      }
      saveFactoryKeys(this.data);
      logInfo(`Factory key ${key.name || key.id} status set to ${status}`);
      return true;
    }
    return false;
  }

  // 获取所有 keys 的状态
  getAllKeys() {
    return this.data.keys.map(k => ({
      id: k.id,
      name: k.name,
      status: k.status,
      failCount: k.failCount,
      lastFailTime: k.lastFailTime,
      totalRequests: k.totalRequests,
      successRequests: k.successRequests,
      successRate: k.totalRequests > 0 
        ? ((k.successRequests / k.totalRequests) * 100).toFixed(2) + '%'
        : 'N/A',
      createdAt: k.createdAt,
      keyPreview: k.key.substring(0, 10) + '...' + k.key.substring(k.key.length - 4)
    }));
  }

  // 获取统计信息
  getStats() {
    const total = this.data.keys.length;
    const active = this.data.keys.filter(k => k.status === 'active').length;
    const failed = this.data.keys.filter(k => k.status === 'failed').length;
    const disabled = this.data.keys.filter(k => k.status === 'disabled').length;
    
    const currentKey = this.getCurrentKey();
    
    return {
      total,
      active,
      failed,
      disabled,
      currentKey: currentKey ? {
        id: currentKey.id,
        name: currentKey.name,
        successRate: currentKey.totalRequests > 0
          ? ((currentKey.successRequests / currentKey.totalRequests) * 100).toFixed(2) + '%'
          : 'N/A'
      } : null
    };
  }
}

// 单例模式
let instance = null;

export function getFactoryKeyManager() {
  if (!instance) {
    instance = new FactoryKeyManager();
  }
  return instance;
}

export function reloadFactoryKeys() {
  if (instance) {
    instance.reload();
  }
}

