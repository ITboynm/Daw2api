// 全局配置
const API_BASE = '';

// ==================== 通知系统 ====================
const NotificationIcons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
};

function showNotification(message, type = 'info', title = '') {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const defaultTitles = {
        success: '成功',
        error: '错误',
        warning: '警告',
        info: '提示'
    };
    
    const notificationTitle = title || defaultTitles[type] || '通知';
    
    notification.innerHTML = `
        <div class="notification-icon">${NotificationIcons[type] || 'ℹ'}</div>
        <div class="notification-content">
            <div class="notification-title">${notificationTitle}</div>
            <div class="notification-message">${message}</div>
        </div>
        <button class="notification-close" onclick="closeNotification(this)">×</button>
    `;
    
    container.appendChild(notification);
    
    // 3秒后自动关闭
    setTimeout(() => {
        closeNotification(notification.querySelector('.notification-close'));
    }, 3000);
}

function closeNotification(btn) {
    const notification = btn.closest('.notification');
    if (notification) {
        notification.classList.add('closing');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }
}

// 便捷方法
function notify(message, type = 'info', title = '') {
    showNotification(message, type, title);
}

function notifySuccess(message, title = '') {
    showNotification(message, 'success', title);
}

function notifyError(message, title = '') {
    showNotification(message, 'error', title);
}

function notifyWarning(message, title = '') {
    showNotification(message, 'warning', title);
}

function notifyInfo(message, title = '') {
    showNotification(message, 'info', title);
}

// ==================== 密钥生成 ====================
/**
 * 生成安全的随机字符串
 * 使用加密安全的随机数生成器
 */
function generateSecureRandomString(length = 32) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const randomValues = new Uint8Array(length);
    crypto.getRandomValues(randomValues);
    
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[randomValues[i] % chars.length];
    }
    return result;
}

/**
 * 生成完整的 API Key
 * 格式: prefix-randomString
 */
function generateApiKey(prefix = 'sk') {
    const randomPart = generateSecureRandomString(32);
    return `${prefix}-${randomPart}`;
}

/**
 * 切换自动生成模式
 */
function toggleAutoGenerateKey() {
    const autoGenerate = document.getElementById('autoGenerateKeyCheckbox').checked;
    const autoMode = document.getElementById('autoGenerateKeyMode');
    const manualMode = document.getElementById('manualKeyMode');
    
    if (autoGenerate) {
        autoMode.style.display = 'block';
        manualMode.style.display = 'none';
        refreshKeyPreview();
    } else {
        autoMode.style.display = 'none';
        manualMode.style.display = 'block';
    }
}

/**
 * 刷新密钥预览
 */
function refreshKeyPreview() {
    const prefix = document.getElementById('keyPrefix').value.trim() || 'sk';
    const generatedKey = generateApiKey(prefix);
    document.getElementById('keyPreview').value = generatedKey;
}

/**
 * 监听前缀输入变化
 */
document.addEventListener('DOMContentLoaded', () => {
    const keyPrefixInput = document.getElementById('keyPrefix');
    if (keyPrefixInput) {
        keyPrefixInput.addEventListener('input', () => {
            refreshKeyPreview();
        });
        // 初始化预览
        refreshKeyPreview();
    }
});

/**
 * 复制到剪贴板
 */
async function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    const text = element.value;
    
    try {
        await navigator.clipboard.writeText(text);
        notifySuccess('密钥已复制到剪贴板！');
    } catch (err) {
        // 降级方案：使用旧的复制方法
        try {
            element.select();
            document.execCommand('copy');
            notifySuccess('密钥已复制到剪贴板！');
        } catch (e) {
            notifyError('复制失败，请手动复制');
        }
    }
}

/**
 * 复制文本到剪贴板（直接传入文本）
 */
async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text);
        notifySuccess('已复制到剪贴板！');
    } catch (err) {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            notifySuccess('已复制到剪贴板！');
        } catch (e) {
            notifyError('复制失败，请手动复制');
        }
        document.body.removeChild(textArea);
    }
}

/**
 * 显示密钥创建成功的通知（带复制按钮）
 */
function showKeySuccessNotification(apiKey) {
    const container = document.getElementById('notificationContainer');
    const notification = document.createElement('div');
    notification.className = 'notification success';
    
    notification.innerHTML = `
        <div class="notification-icon">✓</div>
        <div class="notification-content">
            <div class="notification-title">API Key 创建成功</div>
            <div class="notification-message">
                <div style="margin-bottom: 8px;">密钥已生成，请妥善保存！</div>
                <div style="background: #f7fafc; padding: 8px; border-radius: 4px; font-family: monospace; font-size: 12px; word-break: break-all; margin-bottom: 8px;">
                    ${apiKey}
                </div>
                <button class="btn btn-primary btn-sm" onclick="copyText('${apiKey}')" style="width: 100%;">
                    📋 复制密钥
                </button>
            </div>
        </div>
        <button class="notification-close" onclick="closeNotification(this)">×</button>
    `;
    
    // 设置更长的样式
    notification.style.maxWidth = '500px';
    
    container.appendChild(notification);
    
    // 10秒后自动关闭（比普通通知更久）
    setTimeout(() => {
        if (notification.parentNode) {
            closeNotification(notification.querySelector('.notification-close'));
        }
    }, 10000);
}

// 检查登录状态
function checkAuth() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

// 获取认证 headers
function getAuthHeaders() {
    const token = localStorage.getItem('admin_token');
    if (!token) {
        window.location.href = '/login';
        throw new Error('Not authenticated');
    }
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// API 请求封装
async function apiRequest(url, options = {}) {
    try {
        const response = await fetch(API_BASE + url, {
            ...options,
            headers: {
                ...getAuthHeaders(),
                ...options.headers
            }
        });
        
        if (response.status === 401) {
            // Token 失效，跳转到登录页
            localStorage.removeItem('admin_token');
            window.location.href = '/login';
            throw new Error('认证失败');
        }
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || error.message || '请求失败');
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        if (error.message !== '认证失败') {
            notifyError(error.message);
        }
        throw error;
    }
}

// 切换标签页
function switchTab(tabName) {
    // 更新标签按钮
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // 更新内容区域
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
    
    // 加载对应数据
    switch(tabName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'factory-keys':
            loadFactoryKeys();
            break;
        case 'api-keys':
            loadApiKeys();
            break;
        case 'proxies':
            loadProxies();
            break;
        case 'usage':
            loadUsageStats();
            break;
        case 'logs':
            loadErrorLogs();
            break;
    }
}

// 加载仪表板
async function loadDashboard() {
    try {
        const data = await apiRequest('/api/admin/dashboard');
        
        const html = `
            <div class="stat-card">
                <div class="stat-label">Factory Keys</div>
                <div class="stat-value">${data.factoryKeys.total}</div>
                <div class="stat-sub">活跃: ${data.factoryKeys.active} | 失败: ${data.factoryKeys.failed}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">API Keys</div>
                <div class="stat-value">${data.apiKeys.total}</div>
                <div class="stat-sub">启用: ${data.apiKeys.active} | 禁用: ${data.apiKeys.disabled}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">今日请求</div>
                <div class="stat-value">${data.usage.today.totalRequests}</div>
                <div class="stat-sub">成功: ${data.usage.today.successRequests || 0} | 失败: ${data.usage.today.failedRequests || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">本月请求</div>
                <div class="stat-value">${data.usage.month.totalRequests}</div>
                <div class="stat-sub">成功: ${data.usage.month.successRequests || 0} | 失败: ${data.usage.month.failedRequests || 0}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">当前 Factory Key</div>
                <div style="font-size: 16px; font-weight: 600; margin-top: 10px; color: #333;">
                    ${data.factoryKeys.currentKey ? data.factoryKeys.currentKey.name || data.factoryKeys.currentKey.id : '无'}
                </div>
                <div class="stat-sub">成功率: ${data.factoryKeys.currentKey?.successRate || 'N/A'}</div>
            </div>
        `;
        
        document.getElementById('dashboardStats').innerHTML = html;
    } catch (error) {
        document.getElementById('dashboardStats').innerHTML = '<div class="error">加载失败</div>';
    }
}

// 加载 Factory Keys
async function loadFactoryKeys() {
    try {
        const data = await apiRequest('/api/admin/factory-keys');
        
        if (data.keys.length === 0) {
            document.getElementById('factoryKeysTable').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔑</div>
                    <div>暂无 Factory Keys</div>
                </div>
            `;
            return;
        }
        
        const html = `
            <table>
                <thead>
                    <tr>
                        <th>名称</th>
                        <th>Key</th>
                        <th>状态</th>
                        <th>失败次数</th>
                        <th>总请求</th>
                        <th>成功率</th>
                        <th>创建时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.keys.map(key => `
                        <tr>
                            <td>${key.name || '-'}</td>
                            <td><span class="key-preview">${key.keyPreview}</span></td>
                            <td>
                                <span class="badge ${
                                    key.status === 'active' ? 'badge-success' : 
                                    key.status === 'failed' ? 'badge-danger' : 'badge-secondary'
                                }">
                                    ${key.status === 'active' ? '活跃' : key.status === 'failed' ? '失败' : '禁用'}
                                </span>
                            </td>
                            <td>${key.failCount}</td>
                            <td>${key.totalRequests}</td>
                            <td>${key.successRate}</td>
                            <td>${formatDate(key.createdAt)}</td>
                            <td>
                                <div class="action-buttons">
                                    ${key.status === 'active' ? 
                                        `<button class="btn btn-secondary btn-sm" onclick="toggleFactoryKey('${key.id}', 'disabled')">禁用</button>` :
                                        `<button class="btn btn-success btn-sm" onclick="toggleFactoryKey('${key.id}', 'active')">启用</button>`
                                    }
                                    <button class="btn btn-danger btn-sm" onclick="deleteFactoryKey('${key.id}')">删除</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        document.getElementById('factoryKeysTable').innerHTML = html;
    } catch (error) {
        document.getElementById('factoryKeysTable').innerHTML = '<div class="error">加载失败</div>';
    }
}

// 加载 API Keys
async function loadApiKeys() {
    try {
        const data = await apiRequest('/api/admin/api-keys');
        
        if (data.keys.length === 0) {
            document.getElementById('apiKeysTable').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔐</div>
                    <div>暂无 API Keys</div>
                </div>
            `;
            return;
        }
        
        const html = `
            <table>
                <thead>
                    <tr>
                        <th>名称</th>
                        <th>Key</th>
                        <th>状态</th>
                        <th>每日限制</th>
                        <th>今日请求</th>
                        <th>今日成功率</th>
                        <th>创建时间</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
                    ${data.keys.map(key => `
                        <tr>
                            <td>${key.name || '-'}</td>
                            <td>
                                <span class="key-preview" title="${key.key}">${key.key.substring(0, 10)}...${key.key.substring(key.key.length - 4)}</span>
                                <button class="btn btn-secondary btn-sm" onclick="copyText('${key.key}')" style="margin-left: 4px; padding: 2px 6px; font-size: 11px;">
                                    📋
                                </button>
                            </td>
                            <td>
                                <span class="badge ${key.enabled ? 'badge-success' : 'badge-secondary'}">
                                    ${key.enabled ? '启用' : '禁用'}
                                </span>
                            </td>
                            <td>${key.rateLimit > 0 ? key.rateLimit : '无限制'}</td>
                            <td>${key.todayRequests || 0}</td>
                            <td>${key.todayRequests > 0 ? ((key.todaySuccess || 0) / key.todayRequests * 100).toFixed(1) + '%' : '-'}</td>
                            <td>${formatDate(key.createdAt)}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn btn-primary btn-sm" onclick="viewApiKeyStats('${key.id}')">统计</button>
                                    <button class="btn btn-info btn-sm" onclick="showEditApiKeyModal('${key.id}')">编辑</button>
                                    ${key.enabled ? 
                                        `<button class="btn btn-secondary btn-sm" onclick="toggleApiKey('${key.id}', false)">禁用</button>` :
                                        `<button class="btn btn-success btn-sm" onclick="toggleApiKey('${key.id}', true)">启用</button>`
                                    }
                                    <button class="btn btn-danger btn-sm" onclick="deleteApiKey('${key.id}')">删除</button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        document.getElementById('apiKeysTable').innerHTML = html;
    } catch (error) {
        document.getElementById('apiKeysTable').innerHTML = '<div class="error">加载失败</div>';
    }
}

// 加载代理配置
async function loadProxies() {
    try {
        const data = await apiRequest('/api/admin/proxies');
        
        const html = `
            <div class="form-group">
                <label class="form-label">代理列表 (JSON格式)</label>
                <textarea id="proxiesTextarea" class="form-input" rows="15" style="font-family: monospace;">${JSON.stringify(data.proxies, null, 2)}</textarea>
            </div>
            <button class="btn btn-primary" onclick="saveProxies()">保存配置</button>
            <div style="margin-top: 16px; padding: 12px; background: #edf2f7; border-radius: 6px; font-size: 13px;">
                <strong>格式说明：</strong><br>
                [{"url": "http://proxy1.com:8080", "name": "代理1"}, {"url": "http://proxy2.com:8080", "name": "代理2"}]
            </div>
        `;
        
        document.getElementById('proxiesConfig').innerHTML = html;
    } catch (error) {
        document.getElementById('proxiesConfig').innerHTML = '<div class="error">加载失败</div>';
    }
}

// 加载使用统计
async function loadUsageStats() {
    try {
        const data = await apiRequest('/api/admin/stats');
        
        const html = `
            <div class="stats-grid" style="margin-bottom: 30px;">
                <div class="stat-card">
                    <div class="stat-label">总请求数</div>
                    <div class="stat-value">${data.stats.totalRequests}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">成功请求</div>
                    <div class="stat-value">${data.stats.successRequests || 0}</div>
                    <div class="stat-sub">成功率: ${data.stats.totalRequests > 0 ? ((data.stats.successRequests || 0) / data.stats.totalRequests * 100).toFixed(1) + '%' : '0%'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">失败请求</div>
                    <div class="stat-value">${data.stats.failedRequests || 0}</div>
                    <div class="stat-sub">失败率: ${data.stats.totalRequests > 0 ? ((data.stats.failedRequests || 0) / data.stats.totalRequests * 100).toFixed(1) + '%' : '0%'}</div>
                </div>
            </div>
            
            <h3 style="margin-bottom: 16px; font-size: 16px; font-weight: 600;">按模型统计</h3>
            <table>
                <thead>
                    <tr>
                        <th>模型</th>
                        <th>总请求</th>
                        <th>成功</th>
                        <th>失败</th>
                        <th>成功率</th>
                    </tr>
                </thead>
                <tbody>
                    ${Object.entries(data.stats.modelUsage).map(([model, stats]) => `
                        <tr>
                            <td><strong>${model}</strong></td>
                            <td>${stats.requests}</td>
                            <td>${stats.success || 0}</td>
                            <td>${stats.failed || 0}</td>
                            <td>${stats.requests > 0 ? ((stats.success || 0) / stats.requests * 100).toFixed(1) + '%' : '0%'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        
        document.getElementById('usageStats').innerHTML = html;
    } catch (error) {
        document.getElementById('usageStats').innerHTML = '<div class="error">加载失败</div>';
    }
}

// 加载错误日志
async function loadErrorLogs() {
    try {
        const data = await apiRequest('/api/admin/logs/errors?limit=50');
        
        if (data.logs.length === 0) {
            document.getElementById('errorLogs').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">✅</div>
                    <div>暂无错误日志</div>
                </div>
            `;
            return;
        }
        
        const html = data.logs.reverse().map(log => `
            <div class="log-entry error">
                <div class="log-time">${formatDate(log.timestamp)}</div>
                <div class="log-content">
                    <strong>${log.type}</strong><br>
                    ${log.keyName ? `Key: ${log.keyName}<br>` : ''}
                    ${log.error || log.message || '-'}
                </div>
            </div>
        `).join('');
        
        document.getElementById('errorLogs').innerHTML = html;
    } catch (error) {
        document.getElementById('errorLogs').innerHTML = '<div class="error">加载失败</div>';
    }
}

// Modal 操作
function showAddFactoryKeyModal() {
    document.getElementById('addFactoryKeyModal').classList.add('show');
}

function showAddApiKeyModal() {
    document.getElementById('addApiKeyModal').classList.add('show');
    // 确保是自动生成模式并刷新预览
    document.getElementById('autoGenerateKeyCheckbox').checked = true;
    toggleAutoGenerateKey();
    refreshKeyPreview();
}

async function showEditApiKeyModal(id) {
    try {
        const data = await apiRequest('/api/admin/api-keys');
        const key = data.keys.find(k => k.id === id);
        
        if (!key) {
            notifyError('API Key 不存在');
            return;
        }
        
        // 填充表单
        document.getElementById('editApiKeyId').value = key.id;
        document.getElementById('editApiKeyName').value = key.name || '';
        document.getElementById('editApiKeyRateLimit').value = key.rateLimit || 0;
        document.getElementById('editApiKeyValue').value = key.key;
        
        // 显示模态框
        document.getElementById('editApiKeyModal').classList.add('show');
    } catch (error) {
        // Error already handled
    }
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

// 切换批量模式
function toggleBatchMode() {
    const batchMode = document.getElementById('batchModeCheckbox').checked;
    const singleMode = document.getElementById('singleMode');
    const batchModeDiv = document.getElementById('batchMode');
    const submitBtn = document.getElementById('submitBtn');
    
    if (batchMode) {
        singleMode.style.display = 'none';
        batchModeDiv.style.display = 'block';
        submitBtn.textContent = '批量添加';
        // 清空单个模式的必填项
        document.getElementById('singleKey').removeAttribute('required');
    } else {
        singleMode.style.display = 'block';
        batchModeDiv.style.display = 'none';
        submitBtn.textContent = '添加';
        // 恢复单个模式的必填项
        document.getElementById('singleKey').setAttribute('required', '');
    }
}

// 添加 Factory Key
async function addFactoryKey(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    const batchMode = document.getElementById('batchModeCheckbox').checked;
    
    const submitBtn = event.target.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = batchMode ? '批量添加中...' : '添加中...';
    
    try {
        if (batchMode) {
            // 批量添加模式
            const keysText = formData.get('keys').trim();
            if (!keysText) {
                notifyWarning('请输入至少一个 Key');
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
                return;
            }
            
            const keys = keysText.split('\n').map(k => k.trim()).filter(k => k);
            const namePrefix = formData.get('namePrefix') || 'Key';
            const startNumber = parseInt(formData.get('startNumber')) || 1;
            
            const data = {
                keys: keys,
                namePrefix: namePrefix,
                startNumber: startNumber
            };
            
            await apiRequest('/api/admin/factory-keys/batch', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            notifySuccess(`成功添加 ${keys.length} 个 Factory Keys`);
        } else {
            // 单个添加模式
            const data = {
                key: formData.get('key'),
                name: formData.get('name')
            };
            
            await apiRequest('/api/admin/factory-keys', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            
            notifySuccess('Factory Key 添加成功');
        }
        
        closeModal('addFactoryKeyModal');
        event.target.reset();
        document.getElementById('batchModeCheckbox').checked = false;
        toggleBatchMode(); // 重置为单个模式
        loadFactoryKeys();
        loadDashboard();
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// 添加 API Key
async function addApiKey(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    // 获取 Key（自动生成或手动输入）
    const autoGenerate = document.getElementById('autoGenerateKeyCheckbox').checked;
    let apiKey;
    
    if (autoGenerate) {
        apiKey = document.getElementById('keyPreview').value;
    } else {
        apiKey = document.getElementById('manualKey').value.trim();
        if (!apiKey) {
            notifyWarning('请输入 API Key');
            return;
        }
    }
    
    const data = {
        key: apiKey,
        name: formData.get('name'),
        rateLimit: parseInt(formData.get('rateLimit')) || 0
    };
    
    try {
        await apiRequest('/api/admin/api-keys', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        closeModal('addApiKeyModal');
        event.target.reset();
        
        // 重置为自动生成模式并刷新预览
        document.getElementById('autoGenerateKeyCheckbox').checked = true;
        toggleAutoGenerateKey();
        refreshKeyPreview();
        
        loadApiKeys();
        loadDashboard();
        
        // 显示生成的 Key 并提供复制功能
        showKeySuccessNotification(apiKey);
    } catch (error) {
        // Error already handled by apiRequest
    }
}

// 切换 Factory Key 状态
async function toggleFactoryKey(id, status) {
    try {
        await apiRequest(`/api/admin/factory-keys/${id}/toggle`, {
            method: 'POST',
            body: JSON.stringify({ status })
        });
        
        loadFactoryKeys();
        loadDashboard();
    } catch (error) {
        // Error already handled
    }
}

// 删除 Factory Key
async function deleteFactoryKey(id) {
    if (!confirm('确定要删除这个 Factory Key 吗？')) return;
    
    try {
        await apiRequest(`/api/admin/factory-keys/${id}`, {
            method: 'DELETE'
        });
        
        loadFactoryKeys();
        loadDashboard();
        notifySuccess('Factory Key 已删除');
    } catch (error) {
        // Error already handled
    }
}

// 重置所有 Factory Keys
async function resetAllFactoryKeys() {
    if (!confirm('确定要重置所有 Factory Keys 的失败计数吗？')) return;
    
    try {
        await apiRequest('/api/admin/factory-keys/reset-all', {
            method: 'POST'
        });
        
        loadFactoryKeys();
        loadDashboard();
        notifySuccess('所有 Factory Keys 已重置');
    } catch (error) {
        // Error already handled
    }
}

// 切换 API Key 状态
async function toggleApiKey(id, enabled) {
    try {
        await apiRequest(`/api/admin/api-keys/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ enabled })
        });
        
        loadApiKeys();
        loadDashboard();
    } catch (error) {
        // Error already handled
    }
}

// 更新 API Key
async function updateApiKey(event) {
    event.preventDefault();
    const formData = new FormData(event.target);
    
    const id = formData.get('id');
    const data = {
        name: formData.get('name'),
        rateLimit: parseInt(formData.get('rateLimit')) || 0
    };
    
    try {
        await apiRequest(`/api/admin/api-keys/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        
        closeModal('editApiKeyModal');
        loadApiKeys();
        loadDashboard();
        
        notifySuccess('API Key 已更新');
    } catch (error) {
        // Error already handled
    }
}

// 删除 API Key
async function deleteApiKey(id) {
    if (!confirm('确定要删除这个 API Key 吗？')) return;
    
    try {
        await apiRequest(`/api/admin/api-keys/${id}`, {
            method: 'DELETE'
        });
        
        loadApiKeys();
        loadDashboard();
        notifySuccess('API Key 已删除');
    } catch (error) {
        // Error already handled
    }
}

// 查看 API Key 统计
async function viewApiKeyStats(id) {
    try {
        const data = await apiRequest(`/api/admin/api-keys/${id}/stats`);
        
        let message = `统计信息:\n\n`;
        message += `今日:\n`;
        message += `  请求数: ${data.today.totalRequests}\n`;
        message += `  成功: ${data.today.successRequests || 0}\n`;
        message += `  失败: ${data.today.failedRequests || 0}\n\n`;
        message += `本月:\n`;
        message += `  请求数: ${data.month.totalRequests}\n`;
        message += `  成功: ${data.month.successRequests || 0}\n`;
        message += `  失败: ${data.month.failedRequests || 0}\n\n`;
        message += `总计:\n`;
        message += `  请求数: ${data.stats.totalRequests}\n`;
        message += `  成功: ${data.stats.successRequests || 0}\n`;
        message += `  失败: ${data.stats.failedRequests || 0}`;
        
        notifyInfo(message, 'API Key 统计');
    } catch (error) {
        // Error already handled
    }
}

// 保存代理配置
async function saveProxies() {
    const textarea = document.getElementById('proxiesTextarea');
    try {
        const proxies = JSON.parse(textarea.value);
        
        await apiRequest('/api/admin/proxies', {
            method: 'POST',
            body: JSON.stringify({ proxies })
        });
        
        notifySuccess('保存成功！需要重启服务以生效。', '代理配置');
    } catch (error) {
        notifyError('保存失败: ' + error.message, '代理配置');
    }
}

// 工具函数
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN');
}

function formatNumber(num) {
    return num.toLocaleString('zh-CN');
}

// 登出
async function logout() {
    if (!confirm('确定要退出登录吗？')) return;
    
    try {
        await apiRequest('/api/admin/logout', {
            method: 'POST'
        });
    } catch (error) {
        // 忽略错误
    }
    
    localStorage.removeItem('admin_token');
    window.location.href = '/login';
}

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', () => {
    // 检查登录状态
    if (!checkAuth()) {
        return;
    }
    
    // 验证 token 有效性
    fetch('/api/admin/verify', {
        headers: getAuthHeaders()
    }).then(res => {
        if (!res.ok) {
            localStorage.removeItem('admin_token');
            window.location.href = '/login';
        } else {
            loadDashboard();
        }
    }).catch(() => {
        localStorage.removeItem('admin_token');
        window.location.href = '/login';
    });
});

// 自动刷新（每30秒）
setInterval(() => {
    const activeTab = document.querySelector('.tab.active');
    if (activeTab) {
        activeTab.click();
    }
}, 30000);

