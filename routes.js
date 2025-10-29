import express from 'express';
import fetch from 'node-fetch';
import { getConfig, getModelById, getEndpointByType, getSystemPrompt, getModelReasoning, getRedirectedModelId, getProxyConfigs } from './config.js';
import { logInfo, logDebug, logError, logRequest, logResponse } from './logger.js';
import { transformToAnthropic, getAnthropicHeaders } from './transformers/request-anthropic.js';
import { transformToOpenAI, getOpenAIHeaders } from './transformers/request-openai.js';
import { transformToCommon, getCommonHeaders } from './transformers/request-common.js';
import { AnthropicResponseTransformer } from './transformers/response-anthropic.js';
import { OpenAIResponseTransformer } from './transformers/response-openai.js';
import { getApiKey, getCurrentFactoryKeyId } from './auth.js';
import { getNextProxyAgent } from './proxy-manager.js';
import { apiKeyAuth } from './api-key-auth.js';
import { trackUsage } from './usage-tracker.js';
import { getFactoryKeyManager } from './factory-key-manager.js';
import { addErrorLog } from './data-store.js';
import { shouldBlockClaudeCode, getClaudeCodeBlockedError } from './claude-code-detector.js';

const router = express.Router();

/**
 * Convert a /v1/responses API result to a /v1/chat/completions-compatible format.
 * Works for non-streaming responses.
 */
function convertResponseToChatCompletion(resp) {
  if (!resp || typeof resp !== 'object') {
    throw new Error('Invalid response object');
  }

  const outputMsg = (resp.output || []).find(o => o.type === 'message');
  const textBlocks = outputMsg?.content?.filter(c => c.type === 'output_text') || [];
  const content = textBlocks.map(c => c.text).join('');

  const chatCompletion = {
    id: resp.id ? resp.id.replace(/^resp_/, 'chatcmpl-') : `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: resp.created_at || Math.floor(Date.now() / 1000),
    model: resp.model || 'unknown-model',
    choices: [
      {
        index: 0,
        message: {
          role: outputMsg?.role || 'assistant',
          content: content || ''
        },
        finish_reason: resp.status === 'completed' ? 'stop' : 'unknown'
      }
    ],
    usage: {
      prompt_tokens: resp.usage?.input_tokens ?? 0,
      completion_tokens: resp.usage?.output_tokens ?? 0,
      total_tokens: resp.usage?.total_tokens ?? 0
    }
  };

  return chatCompletion;
}

// Helper function to make request with proxy retry logic
async function makeRequestWithProxyRetry(endpoint, headers, body, maxRetries = 3) {
  const factoryKeyManager = getFactoryKeyManager();
  const factoryKeyId = getCurrentFactoryKeyId();
  const proxies = getProxyConfigs();
  const hasProxies = proxies.length > 0;

  let lastError = null;
  let lastResponse = null;

  // 如果有代理，尝试所有代理；否则只尝试一次直连
  const attemptCount = hasProxies ? Math.min(maxRetries, proxies.length) : 1;

  for (let attempt = 0; attempt < attemptCount; attempt++) {
    let proxyAgentInfo = null;
    let proxyId = 'direct';

    // 获取代理（如果有）
    if (hasProxies) {
      proxyAgentInfo = getNextProxyAgent(endpoint);
      proxyId = proxyAgentInfo?.proxy?.name || proxyAgentInfo?.proxy?.url || 'direct';
    }

    const fetchOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    };

    if (proxyAgentInfo?.agent) {
      fetchOptions.agent = proxyAgentInfo.agent;
    }

    try {
      logInfo(`Request attempt ${attempt + 1}/${attemptCount} using ${proxyId}`);
      const response = await fetch(endpoint, fetchOptions);

      // Success - record it and return
      if (response.ok) {
        if (factoryKeyId) {
          factoryKeyManager.recordSuccess(factoryKeyId, proxyId);
        }
        logInfo(`Request successful with ${proxyId}`);
        return { response, proxyAgentInfo };
      }

      // Response received but not OK (4xx, 5xx)
      const errorText = await response.text();
      const error = new Error(`HTTP ${response.status}: ${errorText}`);
      lastResponse = { status: response.status, text: errorText };
      lastError = error;

      logError(`Request failed with ${proxyId}: ${response.status}`, error);

      // Record failure
      if (factoryKeyId) {
        const result = factoryKeyManager.recordFailure(
          factoryKeyId,
          proxyId,
          error,
          hasProxies,
          response.status
        );

        // 如果是致命错误（401, 403等），不要继续重试
        if ([401, 402, 403].includes(response.status)) {
          logError(`Fatal error ${response.status}, stopping retries`);
          throw error;
        }
      }

      // 如果还有重试机会，继续下一个代理
      if (attempt < attemptCount - 1) {
        logInfo(`Switching to next proxy for retry...`);
        continue;
      }
    } catch (error) {
      // Network error or request failed
      lastError = error;
      logError(`Network error with ${proxyId}`, error);

      if (factoryKeyId) {
        factoryKeyManager.recordFailure(factoryKeyId, proxyId, error, hasProxies);
      }

      // 如果还有重试机会，继续下一个代理
      if (attempt < attemptCount - 1) {
        logInfo(`Network error, switching to next proxy for retry...`);
        continue;
      }
    }
  }

  // 所有重试都失败了
  if (lastResponse) {
    throw new Error(`All ${attemptCount} attempts failed. Last error: HTTP ${lastResponse.status}: ${lastResponse.text}`);
  } else if (lastError) {
    throw lastError;
  } else {
    throw new Error('Request failed with unknown error');
  }
}

router.get('/v1/models', apiKeyAuth, (req, res) => {
  logInfo('GET /v1/models');
  
  try {
    const config = getConfig();
    const models = config.models.map(model => ({
      id: model.id,
      object: 'model',
      created: Date.now(),
      owned_by: model.type,
      permission: [],
      root: model.id,
      parent: null
    }));

    const response = {
      object: 'list',
      data: models
    };

    logResponse(200, null, response);
    res.json(response);
  } catch (error) {
    logError('Error in GET /v1/models', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 标准 OpenAI 聊天补全处理函数（带格式转换）
async function handleChatCompletions(req, res) {
  const startTime = Date.now();
  logInfo('POST /v1/chat/completions');

  try {
    const openaiRequest = req.body;
    const modelId = getRedirectedModelId(openaiRequest.model);

    if (!modelId) {
      return res.status(400).json({ error: 'model is required' });
    }

    const model = getModelById(modelId);
    if (!model) {
      return res.status(404).json({ error: `Model ${modelId} not found` });
    }

    const endpoint = getEndpointByType(model.type);
    if (!endpoint) {
      return res.status(500).json({ error: `Endpoint type ${model.type} not found` });
    }

    logInfo(`Routing to ${model.type} endpoint: ${endpoint.base_url}`);

    // Get API key (will auto-refresh if needed)
    let authHeader;
    try {
      authHeader = await getApiKey(req.headers.authorization);
    } catch (error) {
      logError('Failed to get API key', error);
      return res.status(500).json({ 
        error: 'API key not available',
        message: 'Failed to get or refresh API key. Please check server logs.'
      });
    }

    let transformedRequest;
    let headers;
    const clientHeaders = req.headers;

    // Log received client headers for debugging
    logDebug('Client headers received', {
      'x-factory-client': clientHeaders['x-factory-client'],
      'x-session-id': clientHeaders['x-session-id'],
      'x-assistant-message-id': clientHeaders['x-assistant-message-id'],
      'user-agent': clientHeaders['user-agent']
    });

    // Update request body with redirected model ID before transformation
    const requestWithRedirectedModel = { ...openaiRequest, model: modelId };

    if (model.type === 'anthropic') {
      transformedRequest = transformToAnthropic(requestWithRedirectedModel);
      const isStreaming = openaiRequest.stream === true;
      headers = getAnthropicHeaders(authHeader, clientHeaders, isStreaming, modelId);
    } else if (model.type === 'openai') {
      transformedRequest = transformToOpenAI(requestWithRedirectedModel);
      headers = getOpenAIHeaders(authHeader, clientHeaders);
    } else if (model.type === 'common') {
      transformedRequest = transformToCommon(requestWithRedirectedModel);
      headers = getCommonHeaders(authHeader, clientHeaders);
    } else {
      return res.status(500).json({ error: `Unknown endpoint type: ${model.type}` });
    }

    logRequest('POST', endpoint.base_url, headers, transformedRequest);

    // 使用带重试的请求函数
    let response, proxyAgentInfo;
    try {
      const result = await makeRequestWithProxyRetry(endpoint.base_url, headers, transformedRequest);
      response = result.response;
      proxyAgentInfo = result.proxyAgentInfo;
    } catch (error) {
      // 检查是否是 Claude Code 客户端（如果启用了拦截）
      const isClaudeCodeBlocked = shouldBlockClaudeCode(req);
      if (isClaudeCodeBlocked) {
        return res.status(403).json(getClaudeCodeBlockedError());
      }

      logError('All proxy attempts failed', error);
      return res.status(500).json({
        error: 'Request failed after all retries',
        details: error.message
      });
    }

    logInfo(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      logError(`Endpoint error: ${response.status}`, new Error(errorText));
      
      // 检查是否是 Claude Code 客户端（如果启用了拦截）
      const isClaudeCodeBlocked = shouldBlockClaudeCode(req);
      
      // 处理 Factory Key 切换逻辑（对于 401, 402, 403, 429 等错误）
      const factoryKeyId = getCurrentFactoryKeyId();
      if (factoryKeyId) {
        const factoryKeyManager = getFactoryKeyManager();
        const hasProxies = getProxyConfigs().length > 0;
        const proxyId = proxyAgentInfo?.proxy?.name || proxyAgentInfo?.proxy?.url || 'direct';
        const error = new Error(`HTTP ${response.status}: ${errorText}`);
        
        const result = factoryKeyManager.recordFailure(
          factoryKeyId, 
          proxyId, 
          error, 
          hasProxies, 
          response.status,
          isClaudeCodeBlocked
        );
        
        // 如果是 Claude Code 被拦截，返回特殊错误消息
        if (result.action === 'claude_code_blocked') {
          return res.status(403).json(getClaudeCodeBlockedError());
        }
      }
      
      return res.status(response.status).json({ 
        error: `Endpoint returned ${response.status}`,
        details: errorText 
      });
    }

    const isStreaming = transformedRequest.stream === true;

    if (isStreaming) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // common 类型直接转发，不使用 transformer
      if (model.type === 'common') {
        try {
          for await (const chunk of response.body) {
            res.write(chunk);
          }
          res.end();
          logInfo('Stream forwarded (common type)');
          
          // Track usage
          const responseTime = Date.now() - startTime;
          trackUsage({
            apiKeyId: req.apiKeyData?.id || 'unknown',
            apiKeyName: req.apiKeyData?.name || 'unknown',
            model: modelId,
            endpoint: req.path,
            responseTime,
            success: true
          });
        } catch (streamError) {
          logError('Stream error', streamError);
          res.end();
          
          addErrorLog({
            type: 'stream_error',
            apiKeyId: req.apiKeyData?.id,
            model: modelId,
            error: streamError?.message || String(streamError)
          });
        }
      } else {
        // anthropic 和 openai 类型使用 transformer
        let transformer;
        if (model.type === 'anthropic') {
          transformer = new AnthropicResponseTransformer(modelId, `chatcmpl-${Date.now()}`);
        } else if (model.type === 'openai') {
          transformer = new OpenAIResponseTransformer(modelId, `chatcmpl-${Date.now()}`);
        }

        try {
          for await (const chunk of transformer.transformStream(response.body)) {
            res.write(chunk);
          }
          res.end();
          logInfo('Stream completed');
          
          const responseTime = Date.now() - startTime;
          trackUsage({
            apiKeyId: req.apiKeyData?.id || 'unknown',
            apiKeyName: req.apiKeyData?.name || 'unknown',
            model: modelId,
            endpoint: req.path,
            responseTime,
            success: true
          });
        } catch (streamError) {
          logError('Stream error', streamError);
          res.end();
          
          const responseTime = Date.now() - startTime;
          trackUsage({
            apiKeyId: req.apiKeyData?.id || 'unknown',
            apiKeyName: req.apiKeyData?.name || 'unknown',
            model: modelId,
            endpoint: req.path,
            responseTime,
            success: false,
            error: streamError?.message || String(streamError)
          });
          
          addErrorLog({
            type: 'stream_error',
            apiKeyId: req.apiKeyData?.id,
            model: modelId,
            error: streamError?.message || String(streamError)
          });
        }
      }
    } else {
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      // Track usage
      trackUsage({
        apiKeyId: req.apiKeyData?.id || 'unknown',
        apiKeyName: req.apiKeyData?.name || 'unknown',
        model: modelId,
        endpoint: req.path,
        responseTime,
        success: true
      });
      
      if (model.type === 'openai') {
        try {
          const converted = convertResponseToChatCompletion(data);
          logResponse(200, null, converted);
          res.json(converted);
        } catch (e) {
          // 如果转换失败，回退为原始数据
          logResponse(200, null, data);
          res.json(data);
        }
      } else {
        // anthropic/common: 保持现有逻辑，直接转发
        logResponse(200, null, data);
        res.json(data);
      }
    }

  } catch (error) {
    logError('Error in /v1/chat/completions', error);
    
    const responseTime = Date.now() - startTime;
    trackUsage({
      apiKeyId: req.apiKeyData?.id || 'unknown',
      apiKeyName: req.apiKeyData?.name || 'unknown',
      model: req.body?.model || 'unknown',
      endpoint: req.path,
      responseTime,
      success: false,
      error: error.message
    });
    
    addErrorLog({
      type: 'request_error',
      apiKeyId: req.apiKeyData?.id,
      endpoint: '/v1/chat/completions',
      error: error.message
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// 直接转发 OpenAI 请求（不做格式转换）
async function handleDirectResponses(req, res) {
  const startTime = Date.now();
  logInfo('POST /v1/responses');

  try {
    const openaiRequest = req.body;
    const modelId = getRedirectedModelId(openaiRequest.model);

    if (!modelId) {
      return res.status(400).json({ error: 'model is required' });
    }

    const model = getModelById(modelId);
    if (!model) {
      return res.status(404).json({ error: `Model ${modelId} not found` });
    }

    // 只允许 openai 类型端点
    if (model.type !== 'openai') {
      return res.status(400).json({ 
        error: 'Invalid endpoint type',
        message: `/v1/responses 接口只支持 openai 类型端点，当前模型 ${modelId} 是 ${model.type} 类型`
      });
    }

    const endpoint = getEndpointByType(model.type);
    if (!endpoint) {
      return res.status(500).json({ error: `Endpoint type ${model.type} not found` });
    }

    logInfo(`Direct forwarding to ${model.type} endpoint: ${endpoint.base_url}`);

    // Get API key - support client x-api-key for anthropic endpoint
    let authHeader;
    try {
      const clientAuthFromXApiKey = req.headers['x-api-key']
        ? `Bearer ${req.headers['x-api-key']}`
        : null;
      authHeader = await getApiKey(req.headers.authorization || clientAuthFromXApiKey);
    } catch (error) {
      logError('Failed to get API key', error);
      return res.status(500).json({ 
        error: 'API key not available',
        message: 'Failed to get or refresh API key. Please check server logs.'
      });
    }

    const clientHeaders = req.headers;
    
    // 获取 headers
    const headers = getOpenAIHeaders(authHeader, clientHeaders);

    // 注入系统提示到 instructions 字段，并更新重定向后的模型ID
    const systemPrompt = getSystemPrompt();
    const modifiedRequest = { ...openaiRequest, model: modelId };
    if (systemPrompt) {
      // 如果已有 instructions，则在前面添加系统提示
      if (modifiedRequest.instructions) {
        modifiedRequest.instructions = systemPrompt + modifiedRequest.instructions;
      } else {
        // 否则直接设置系统提示
        modifiedRequest.instructions = systemPrompt;
      }
    }

    // 处理reasoning字段
    const reasoningLevel = getModelReasoning(modelId);
    if (reasoningLevel === 'auto') {
      // Auto模式：保持原始请求的reasoning字段不变
      // 如果原始请求有reasoning字段就保留，没有就不添加
    } else if (reasoningLevel && ['low', 'medium', 'high'].includes(reasoningLevel)) {
      modifiedRequest.reasoning = {
        effort: reasoningLevel,
        summary: 'auto'
      };
    } else {
      // 如果配置是off或无效，移除reasoning字段
      delete modifiedRequest.reasoning;
    }

    logRequest('POST', endpoint.base_url, headers, modifiedRequest);

    // 使用带重试的请求函数
    let response, proxyAgentInfo;
    try {
      const result = await makeRequestWithProxyRetry(endpoint.base_url, headers, modifiedRequest);
      response = result.response;
      proxyAgentInfo = result.proxyAgentInfo;
    } catch (error) {
      // 检查是否是 Claude Code 客户端（如果启用了拦截）
      const isClaudeCodeBlocked = shouldBlockClaudeCode(req);
      if (isClaudeCodeBlocked) {
        return res.status(403).json(getClaudeCodeBlockedError());
      }

      logError('All proxy attempts failed', error);
      const responseTime = Date.now() - startTime;
      trackUsage({
        apiKeyId: req.apiKeyData?.id || 'unknown',
        apiKeyName: req.apiKeyData?.name || 'unknown',
        model: modelId,
        endpoint: req.path,
        responseTime,
        success: false,
        error: error.message
      });

      return res.status(500).json({
        error: 'Request failed after all retries',
        details: error.message
      });
    }

    logInfo(`Response status: ${response.status}`);

    const isStreaming = openaiRequest.stream === true;

    if (isStreaming) {
      // 直接转发流式响应，不做任何转换
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        // 直接将原始响应流转发给客户端
        for await (const chunk of response.body) {
          res.write(chunk);
        }
        res.end();
        logInfo('Stream forwarded successfully');
        
        // Track usage
        const responseTime = Date.now() - startTime;
        trackUsage({
          apiKeyId: req.apiKeyData?.id || 'unknown',
          apiKeyName: req.apiKeyData?.name || 'unknown',
          model: modelId,
          endpoint: req.path,
          responseTime,
          success: true
        });
      } catch (streamError) {
        logError('Stream error', streamError);
        res.end();
        
        const responseTime = Date.now() - startTime;
        trackUsage({
          apiKeyId: req.apiKeyData?.id || 'unknown',
          apiKeyName: req.apiKeyData?.name || 'unknown',
          model: modelId,
          endpoint: req.path,
          responseTime,
          success: false,
          error: streamError?.message || String(streamError)
        });
        
        addErrorLog({
          type: 'stream_error',
          apiKeyId: req.apiKeyData?.id,
          model: modelId,
          error: streamError?.message || String(streamError)
        });
      }
    } else {
      // 直接转发非流式响应，不做任何转换
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      // Track usage
      trackUsage({
        apiKeyId: req.apiKeyData?.id || 'unknown',
        apiKeyName: req.apiKeyData?.name || 'unknown',
        model: modelId,
        endpoint: req.path,
        responseTime,
        success: true
      });
      
      logResponse(200, null, data);
      res.json(data);
    }

  } catch (error) {
    logError('Error in /v1/responses', error);
    
    const responseTime = Date.now() - startTime;
    trackUsage({
      apiKeyId: req.apiKeyData?.id || 'unknown',
      apiKeyName: req.apiKeyData?.name || 'unknown',
      model: req.body?.model || 'unknown',
      endpoint: req.path,
      responseTime,
      success: false,
      error: error.message
    });
    
    addErrorLog({
      type: 'request_error',
      apiKeyId: req.apiKeyData?.id,
      endpoint: '/v1/responses',
      error: error.message
    });
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

// 直接转发 Anthropic 请求（不做格式转换）
async function handleDirectMessages(req, res) {
  const startTime = Date.now();
  logInfo('POST /v1/messages');

  try {
    const anthropicRequest = req.body;
    const modelId = getRedirectedModelId(anthropicRequest.model);

    if (!modelId) {
      return res.status(400).json({ error: 'model is required' });
    }

    const model = getModelById(modelId);
    if (!model) {
      return res.status(404).json({ error: `Model ${modelId} not found` });
    }

    // 只允许 anthropic 类型端点
    if (model.type !== 'anthropic') {
      return res.status(400).json({ 
        error: 'Invalid endpoint type',
        message: `/v1/messages 接口只支持 anthropic 类型端点，当前模型 ${modelId} 是 ${model.type} 类型`
      });
    }

    const endpoint = getEndpointByType(model.type);
    if (!endpoint) {
      return res.status(500).json({ error: `Endpoint type ${model.type} not found` });
    }

    logInfo(`Direct forwarding to ${model.type} endpoint: ${endpoint.base_url}`);

    // Get API key - support client x-api-key for anthropic endpoint
    let authHeader;
    try {
      const clientAuthFromXApiKey = req.headers['x-api-key']
        ? `Bearer ${req.headers['x-api-key']}`
        : null;
      authHeader = await getApiKey(req.headers.authorization || clientAuthFromXApiKey);
    } catch (error) {
      logError('Failed to get API key', error);
      return res.status(500).json({ 
        error: 'API key not available',
        message: 'Failed to get or refresh API key. Please check server logs.'
      });
    }

    const clientHeaders = req.headers;
    
    // 获取 headers
    const isStreaming = anthropicRequest.stream === true;
    const headers = getAnthropicHeaders(authHeader, clientHeaders, isStreaming, modelId);

    // 注入系统提示到 system 字段，并更新重定向后的模型ID
    const systemPrompt = getSystemPrompt();
    const modifiedRequest = { ...anthropicRequest, model: modelId };
    if (systemPrompt) {
      if (modifiedRequest.system && Array.isArray(modifiedRequest.system)) {
        // 如果已有 system 数组，则在最前面插入系统提示
        modifiedRequest.system = [
          { type: 'text', text: systemPrompt },
          ...modifiedRequest.system
        ];
      } else {
        // 否则创建新的 system 数组
        modifiedRequest.system = [
          { type: 'text', text: systemPrompt }
        ];
      }
    }

    // 处理thinking字段
    const reasoningLevel = getModelReasoning(modelId);
    if (reasoningLevel === 'auto') {
      // Auto模式：保持原始请求的thinking字段不变
      // 如果原始请求有thinking字段就保留，没有就不添加
    } else if (reasoningLevel && ['low', 'medium', 'high'].includes(reasoningLevel)) {
      const budgetTokens = {
        'low': 4096,
        'medium': 12288,
        'high': 24576
      };
      
      modifiedRequest.thinking = {
        type: 'enabled',
        budget_tokens: budgetTokens[reasoningLevel]
      };
    } else {
      // 如果配置是off或无效，移除thinking字段
      delete modifiedRequest.thinking;
    }

    logRequest('POST', endpoint.base_url, headers, modifiedRequest);

    // 使用带重试的请求函数
    let response, proxyAgentInfo;
    try {
      const result = await makeRequestWithProxyRetry(endpoint.base_url, headers, modifiedRequest);
      response = result.response;
      proxyAgentInfo = result.proxyAgentInfo;
    } catch (error) {
      // 检查是否是 Claude Code 客户端（如果启用了拦截）
      const isClaudeCodeBlocked = shouldBlockClaudeCode(req);
      if (isClaudeCodeBlocked) {
        return res.status(403).json(getClaudeCodeBlockedError());
      }

      logError('All proxy attempts failed', error);
      const responseTime = Date.now() - startTime;
      trackUsage({
        apiKeyId: req.apiKeyData?.id || 'unknown',
        apiKeyName: req.apiKeyData?.name || 'unknown',
        model: modelId,
        endpoint: req.path,
        responseTime,
        success: false,
        error: error.message
      });

      return res.status(500).json({
        error: 'Request failed after all retries',
        details: error.message
      });
    }

    logInfo(`Response status: ${response.status}`);

    if (isStreaming) {
      // 直接转发流式响应，不做任何转换
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      try {
        // 直接将原始响应流转发给客户端
        for await (const chunk of response.body) {
          res.write(chunk);
        }
        res.end();
        logInfo('Stream forwarded successfully');
        
        // Track usage
        const responseTime = Date.now() - startTime;
        trackUsage({
          apiKeyId: req.apiKeyData?.id || 'unknown',
          apiKeyName: req.apiKeyData?.name || 'unknown',
          model: modelId,
          endpoint: req.path,
          responseTime,
          success: true
        });
      } catch (streamError) {
        logError('Stream error', streamError);
        res.end();
        
        const responseTime = Date.now() - startTime;
        trackUsage({
          apiKeyId: req.apiKeyData?.id || 'unknown',
          apiKeyName: req.apiKeyData?.name || 'unknown',
          model: modelId,
          endpoint: req.path,
          responseTime,
          success: false,
          error: streamError?.message || String(streamError)
        });
        
        addErrorLog({
          type: 'stream_error',
          apiKeyId: req.apiKeyData?.id,
          model: modelId,
          error: streamError?.message || String(streamError)
        });
      }
    } else {
      // 直接转发非流式响应，不做任何转换
      const data = await response.json();
      const responseTime = Date.now() - startTime;
      
      // Track usage
      trackUsage({
        apiKeyId: req.apiKeyData?.id || 'unknown',
        apiKeyName: req.apiKeyData?.name || 'unknown',
        model: modelId,
        endpoint: req.path,
        responseTime,
        success: true
      });
      
      logResponse(200, null, data);
      res.json(data);
    }

  } catch (error) {
    logError('Error in /v1/messages', error);
    
    const responseTime = Date.now() - startTime;
    trackUsage({
      apiKeyId: req.apiKeyData?.id || 'unknown',
      apiKeyName: req.apiKeyData?.name || 'unknown',
      model: req.body?.model || 'unknown',
      endpoint: req.path,
      responseTime,
      success: false,
      error: error.message
    });
    
    addErrorLog({
      type: 'request_error',
      apiKeyId: req.apiKeyData?.id,
      endpoint: '/v1/messages',
      error: error.message
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// 处理 Anthropic count_tokens 请求
async function handleCountTokens(req, res) {
  logInfo('POST /v1/messages/count_tokens');

  try {
    const anthropicRequest = req.body;
    const modelId = getRedirectedModelId(anthropicRequest.model);

    if (!modelId) {
      return res.status(400).json({ error: 'model is required' });
    }

    const model = getModelById(modelId);
    if (!model) {
      return res.status(404).json({ error: `Model ${modelId} not found` });
    }

    // 只允许 anthropic 类型端点
    if (model.type !== 'anthropic') {
      return res.status(400).json({
        error: 'Invalid endpoint type',
        message: `/v1/messages/count_tokens 接口只支持 anthropic 类型端点，当前模型 ${modelId} 是 ${model.type} 类型`
      });
    }

    const endpoint = getEndpointByType('anthropic');
    if (!endpoint) {
      return res.status(500).json({ error: 'Endpoint type anthropic not found' });
    }

    // Get API key
    let authHeader;
    try {
      const clientAuthFromXApiKey = req.headers['x-api-key']
        ? `Bearer ${req.headers['x-api-key']}`
        : null;
      authHeader = await getApiKey(req.headers.authorization || clientAuthFromXApiKey);
    } catch (error) {
      logError('Failed to get API key', error);
      return res.status(500).json({
        error: 'API key not available',
        message: 'Failed to get or refresh API key. Please check server logs.'
      });
    }

    const clientHeaders = req.headers;
    const headers = getAnthropicHeaders(authHeader, clientHeaders, false, modelId);

    // 构建 count_tokens 端点 URL
    const countTokensUrl = endpoint.base_url.replace('/v1/messages', '/v1/messages/count_tokens');

    // 更新请求体中的模型ID为重定向后的ID
    const modifiedRequest = { ...anthropicRequest, model: modelId };

    logInfo(`Forwarding to count_tokens endpoint: ${countTokensUrl}`);
    logRequest('POST', countTokensUrl, headers, modifiedRequest);

    const proxyAgentInfo = getNextProxyAgent(countTokensUrl);
    const fetchOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify(modifiedRequest)
    };

    if (proxyAgentInfo?.agent) {
      fetchOptions.agent = proxyAgentInfo.agent;
    }

    const response = await fetch(countTokensUrl, fetchOptions);

    logInfo(`Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      logError(`Count tokens error: ${response.status}`, new Error(errorText));
      return res.status(response.status).json({
        error: `Endpoint returned ${response.status}`,
        details: errorText
      });
    }

    const data = await response.json();
    logResponse(200, null, data);
    res.json(data);

  } catch (error) {
    logError('Error in /v1/messages/count_tokens', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// 注册路由 - 添加 API Key 认证中间件
router.post('/v1/chat/completions', apiKeyAuth, handleChatCompletions);
router.post('/v1/responses', apiKeyAuth, handleDirectResponses);
router.post('/v1/messages', apiKeyAuth, handleDirectMessages);
router.post('/v1/messages/count_tokens', apiKeyAuth, handleCountTokens);

export default router;
