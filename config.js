import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let config = null;

export function loadConfig() {
  try {
    const configPath = path.join(__dirname, 'config.json');
    const localConfigPath = path.join(__dirname, 'config.local.json');

    // 先加载默认配置
    const configData = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(configData);

    // 如果存在 config.local.json，合并配置（local 配置优先）
    if (fs.existsSync(localConfigPath)) {
      try {
        const localConfigData = fs.readFileSync(localConfigPath, 'utf-8');
        const localConfig = JSON.parse(localConfigData);

        // 深度合并配置
        config = {
          ...config,
          ...localConfig,
          // 特殊处理数组字段，优先使用 local 配置
          endpoint: localConfig.endpoint || config.endpoint,
          proxies: localConfig.proxies || config.proxies,
          models: localConfig.models || config.models,
          model_redirects: {
            ...config.model_redirects,
            ...localConfig.model_redirects
          }
        };

        logInfo('Loaded configuration from config.local.json (overrides config.json)');
      } catch (localError) {
        logInfo(`Failed to load config.local.json: ${localError.message}. Using config.json only.`);
      }
    }

    return config;
  } catch (error) {
    throw new Error(`Failed to load config.json: ${error.message}`);
  }
}

export function getConfig() {
  if (!config) {
    loadConfig();
  }
  return config;
}

export function getModelById(modelId) {
  const cfg = getConfig();
  return cfg.models.find(m => m.id === modelId);
}

export function getEndpointByType(type) {
  const cfg = getConfig();
  return cfg.endpoint.find(e => e.name === type);
}

export function isDevMode() {
  const cfg = getConfig();
  return cfg.dev_mode === true;
}

export function getPort() {
  const cfg = getConfig();
  return cfg.port || 3000;
}

export function getSystemPrompt() {
  const cfg = getConfig();
  return cfg.system_prompt || '';
}

export function getModelReasoning(modelId) {
  const model = getModelById(modelId);
  if (!model || !model.reasoning) {
    return null;
  }
  const reasoningLevel = model.reasoning.toLowerCase();
  if (['low', 'medium', 'high', 'auto'].includes(reasoningLevel)) {
    return reasoningLevel;
  }
  return null;
}

export function getUserAgent() {
  const cfg = getConfig();
  return cfg.user_agent || 'factory-cli/0.19.3';
}

export function getProxyConfigs() {
  const cfg = getConfig();
  if (!Array.isArray(cfg.proxies)) {
    return [];
  }
  return cfg.proxies.filter(proxy => proxy && typeof proxy === 'object');
}

export function getRedirectedModelId(modelId) {
  const cfg = getConfig();
  if (cfg.model_redirects && cfg.model_redirects[modelId]) {
    const redirectedId = cfg.model_redirects[modelId];
    console.log(`[REDIRECT] Model redirected: ${modelId} -> ${redirectedId}`);
    logInfo(`Model redirected: ${modelId} -> ${redirectedId}`);
    return redirectedId;
  }
  return modelId;
}

export function getAdminCredentials() {
  const cfg = getConfig();
  return {
    username: process.env.ADMIN_USERNAME || cfg.admin_username || 'admin',
    password: process.env.ADMIN_PASSWORD || cfg.admin_password || 'admin123'
  };
}
