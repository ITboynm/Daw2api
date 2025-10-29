// AI 模型价格配置（美元/百万 tokens）
// 数据来源：各官方网站的最新定价

const MODEL_PRICING = {
  // Anthropic Claude 模型
  'claude-opus-4-1-20250805': {
    input: 15.0,
    output: 75.0
  },
  'claude-sonnet-4-5-20250929': {
    input: 3.0,
    output: 15.0
  },
  'claude-haiku-4-5-20251001': {
    input: 0.8,
    output: 4.0
  },
  'claude-3-5-sonnet-20241022': {
    input: 3.0,
    output: 15.0
  },
  'claude-3-5-haiku-20241022': {
    input: 0.8,
    output: 4.0
  },
  'claude-3-opus-20240229': {
    input: 15.0,
    output: 75.0
  },
  'claude-3-sonnet-20240229': {
    input: 3.0,
    output: 15.0
  },
  'claude-3-haiku-20240307': {
    input: 0.25,
    output: 1.25
  },

  // OpenAI GPT 模型
  'gpt-5-2025-08-07': {
    input: 10.0,
    output: 30.0
  },
  'gpt-5-codex': {
    input: 10.0,
    output: 30.0
  },
  'gpt-4-turbo': {
    input: 10.0,
    output: 30.0
  },
  'gpt-4': {
    input: 30.0,
    output: 60.0
  },
  'gpt-4-32k': {
    input: 60.0,
    output: 120.0
  },
  'gpt-3.5-turbo': {
    input: 0.5,
    output: 1.5
  },
  'gpt-3.5-turbo-16k': {
    input: 3.0,
    output: 4.0
  },

  // 其他模型（估算价格）
  'glm-4.6': {
    input: 1.0,
    output: 1.0
  }
};

/**
 * 计算请求的成本
 * @param {string} model - 模型名称
 * @param {number} inputTokens - 输入 tokens 数量
 * @param {number} outputTokens - 输出 tokens 数量
 * @returns {number} 成本（美元）
 */
export function calculateCost(model, inputTokens = 0, outputTokens = 0) {
  const pricing = MODEL_PRICING[model];
  
  if (!pricing) {
    // 如果找不到模型定价，使用默认值
    console.warn(`No pricing found for model: ${model}, using default pricing`);
    const defaultPricing = { input: 1.0, output: 2.0 };
    return ((inputTokens * defaultPricing.input) + (outputTokens * defaultPricing.output)) / 1000000;
  }
  
  const cost = ((inputTokens * pricing.input) + (outputTokens * pricing.output)) / 1000000;
  return Math.round(cost * 1000000) / 1000000; // 保留6位小数
}

/**
 * 获取模型定价信息
 * @param {string} model - 模型名称
 * @returns {object|null} 定价信息
 */
export function getModelPricing(model) {
  return MODEL_PRICING[model] || null;
}

/**
 * 获取所有模型定价
 * @returns {object} 所有模型的定价信息
 */
export function getAllPricing() {
  return MODEL_PRICING;
}

/**
 * 格式化价格显示
 * @param {number} cost - 价格（美元）
 * @returns {string} 格式化后的价格字符串
 */
export function formatCost(cost) {
  if (cost < 0.000001) {
    return '$0.00';
  }
  if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  }
  return `$${cost.toFixed(4)}`;
}

