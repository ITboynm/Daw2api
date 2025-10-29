import express from 'express';
import { adminAuth, adminLogin, verifyToken, adminLogout } from './api-key-auth.js';
import { getFactoryKeyManager, reloadFactoryKeys } from './factory-key-manager.js';
import { 
  loadFactoryKeys, 
  addFactoryKey, 
  updateFactoryKey, 
  deleteFactoryKey,
  loadApiKeys,
  addApiKey,
  updateApiKey,
  deleteApiKey,
  loadUsageLogs,
  loadErrorLogs,
  getUsageStats
} from './data-store.js';
import { getProxyConfigs, getConfig } from './config.js';
import { getAllUsage, getTodayUsage, getMonthUsage } from './usage-tracker.js';
import { getAllPricing } from './pricing.js';

const router = express.Router();

// 登录路由（不需要认证）
router.post('/api/admin/login', adminLogin);

// 验证 token（不需要认证）
router.get('/api/admin/verify', verifyToken);

// 登出路由
router.post('/api/admin/logout', adminLogout);

// 其他所有管理后台路由都需要管理员认证
router.use('/api/admin', adminAuth);

// ==================== Dashboard 统计 ====================
router.get('/api/admin/dashboard', (req, res) => {
  try {
    const factoryKeyManager = getFactoryKeyManager();
    const factoryStats = factoryKeyManager.getStats();
    const todayUsage = getTodayUsage();
    const monthUsage = getMonthUsage();
    const apiKeys = loadApiKeys();

    res.json({
      factoryKeys: factoryStats,
      apiKeys: {
        total: apiKeys.keys.length,
        active: apiKeys.keys.filter(k => k.enabled).length,
        disabled: apiKeys.keys.filter(k => !k.enabled).length
      },
      usage: {
        today: todayUsage,
        month: monthUsage
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Factory Keys 管理 ====================

// 获取所有 Factory Keys
router.get('/api/admin/factory-keys', (req, res) => {
  try {
    const manager = getFactoryKeyManager();
    const keys = manager.getAllKeys();
    res.json({ keys });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加 Factory Key
router.post('/api/admin/factory-keys', (req, res) => {
  try {
    const { key, name } = req.body;
    if (!key || !key.trim()) {
      return res.status(400).json({ error: 'Key is required' });
    }
    
    const newKey = addFactoryKey(key.trim(), name || '');
    reloadFactoryKeys();
    res.json({ success: true, key: newKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 批量添加 Factory Keys
router.post('/api/admin/factory-keys/batch', (req, res) => {
  try {
    const { keys, namePrefix, startNumber } = req.body;
    
    if (!keys || !Array.isArray(keys) || keys.length === 0) {
      return res.status(400).json({ error: 'Keys array is required' });
    }
    
    const prefix = namePrefix || 'Key';
    const start = startNumber || 1;
    const addedKeys = [];
    
    keys.forEach((key, index) => {
      if (key && key.trim()) {
        const name = `${prefix}-${start + index}`;
        const newKey = addFactoryKey(key.trim(), name);
        addedKeys.push(newKey);
      }
    });
    
    reloadFactoryKeys();
    
    res.json({ 
      success: true, 
      count: addedKeys.length,
      keys: addedKeys 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新 Factory Key
router.put('/api/admin/factory-keys/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedKey = updateFactoryKey(id, updates);
    if (!updatedKey) {
      return res.status(404).json({ error: 'Factory key not found' });
    }
    
    reloadFactoryKeys();
    res.json({ success: true, key: updatedKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除 Factory Key
router.delete('/api/admin/factory-keys/:id', (req, res) => {
  try {
    const { id } = req.params;
    deleteFactoryKey(id);
    reloadFactoryKeys();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 启用/禁用 Factory Key
router.post('/api/admin/factory-keys/:id/toggle', (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const manager = getFactoryKeyManager();
    const success = manager.setKeyStatus(id, status);
    
    if (!success) {
      return res.status(404).json({ error: 'Factory key not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 重置所有 Factory Keys 失败计数
router.post('/api/admin/factory-keys/reset-all', (req, res) => {
  try {
    const manager = getFactoryKeyManager();
    manager.resetAllFailCounts();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== API Keys 管理 ====================

// 获取所有 API Keys
router.get('/api/admin/api-keys', (req, res) => {
  try {
    const data = loadApiKeys();
    const keysWithStats = data.keys.map(key => {
      const stats = getTodayUsage(key.id);
      return {
        ...key,
        todayRequests: stats.totalRequests,
        todaySuccess: stats.successRequests || 0
      };
    });
    res.json({ keys: keysWithStats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加 API Key
router.post('/api/admin/api-keys', (req, res) => {
  try {
    const { key, name, rateLimit } = req.body;
    if (!key || !key.trim()) {
      return res.status(400).json({ error: 'Key is required' });
    }
    
    const newKey = addApiKey(key.trim(), name || '', parseInt(rateLimit) || 0);
    res.json({ success: true, key: newKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新 API Key
router.put('/api/admin/api-keys/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const updatedKey = updateApiKey(id, updates);
    if (!updatedKey) {
      return res.status(404).json({ error: 'API key not found' });
    }
    
    res.json({ success: true, key: updatedKey });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除 API Key
router.delete('/api/admin/api-keys/:id', (req, res) => {
  try {
    const { id } = req.params;
    deleteApiKey(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个 API Key 的使用统计
router.get('/api/admin/api-keys/:id/stats', (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;
    
    const stats = getUsageStats(id, startDate, endDate);
    const todayStats = getTodayUsage(id);
    const monthStats = getMonthUsage(id);
    
    res.json({
      stats,
      today: todayStats,
      month: monthStats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== Proxies 管理 ====================

// 获取所有代理配置
router.get('/api/admin/proxies', (req, res) => {
  try {
    const proxies = getProxyConfigs();
    res.json({ proxies });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新代理配置（需要修改 config.json）
router.post('/api/admin/proxies', async (req, res) => {
  try {
    const { proxies } = req.body;
    const config = getConfig();
    config.proxies = proxies;
    
    // 保存到 config.json
    const fs = await import('fs');
    const path = await import('path');
    const { fileURLToPath } = await import('url');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const configPath = path.join(__dirname, 'config.json');
    
    fs.default.writeFileSync(configPath, JSON.stringify(config, null, 2));
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 日志查看 ====================

// 获取使用日志
router.get('/api/admin/logs/usage', (req, res) => {
  try {
    const { limit } = req.query;
    const logs = loadUsageLogs(parseInt(limit) || 100);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取错误日志
router.get('/api/admin/logs/errors', (req, res) => {
  try {
    const { limit } = req.query;
    const logs = loadErrorLogs(parseInt(limit) || 100);
    res.json({ logs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 统计报表 ====================

// 获取整体使用统计
router.get('/api/admin/stats', (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const stats = getUsageStats(null, startDate, endDate);
    res.json({ stats });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取模型价格列表
router.get('/api/admin/pricing', (req, res) => {
  try {
    const pricing = getAllPricing();
    res.json({ pricing });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 系统配置 ====================

// 获取系统配置
router.get('/api/admin/config', (req, res) => {
  try {
    const config = getConfig();
    res.json({ config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== 系统设置 ====================

// 获取系统设置
router.get('/api/admin/settings', (req, res) => {
  try {
    const config = getConfig();
    res.json({ 
      blockClaudeCode: config.blockClaudeCode || false
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新系统设置
router.put('/api/admin/settings', async (req, res) => {
  try {
    const { blockClaudeCode } = req.body;
    
    // 读取当前配置
    const fs = await import('fs');
    const configPath = './config.json';
    const configData = await fs.promises.readFile(configPath, 'utf8');
    const config = JSON.parse(configData);
    
    // 更新配置
    if (typeof blockClaudeCode === 'boolean') {
      config.blockClaudeCode = blockClaudeCode;
    }
    
    // 保存配置
    await fs.promises.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8');
    
    res.json({ 
      success: true,
      blockClaudeCode: config.blockClaudeCode 
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

