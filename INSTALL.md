# Droid2API 安装和配置指南

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置管理员账号

编辑 `config.json` 文件：

```json
{
  "port": 3000,
  "admin_username": "admin",
  "admin_password": "your_secure_password_here",
  ...
}
```

或者使用环境变量：

```bash
export ADMIN_USERNAME=admin
export ADMIN_PASSWORD=your_secure_password
```

### 3. 启动服务

```bash
npm start
```

服务启动后会显示：
```
============================================================
Available API Endpoints:
  GET  /v1/models
  POST /v1/chat/completions
  POST /v1/responses
  POST /v1/messages
  POST /v1/messages/count_tokens

Management Dashboard:
  http://localhost:3000/admin/admin.html

Note: API endpoints require authentication via API Key
============================================================
```

### 4. 访问管理后台

浏览器打开：`http://localhost:3000/admin/admin.html`

使用你配置的管理员账号密码登录。

### 5. 添加 Factory Keys

在管理后台中：
1. 点击 "Factory Keys" 标签
2. 点击 "添加 Key" 按钮
3. 输入你的 Factory API Key
4. 输入名称（可选）
5. 点击"添加"

### 6. 添加 API Keys（客户端使用）

在管理后台中：
1. 点击 "API Keys" 标签
2. 点击 "添加 Key" 按钮
3. 输入自定义的 API Key（比如：`sk-test-123456`）
4. 输入名称（比如：`测试应用`）
5. 设置每日请求限制（0 为不限制）
6. 点击"添加"

### 7. 测试接口

```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test-123456" \
  -d '{
    "model": "claude-sonnet-4-5",
    "messages": [{"role": "user", "content": "Hello, how are you?"}]
  }'
```

## 可选配置

### 代理配置

如果需要使用代理，在 `config.json` 中配置：

```json
{
  "proxies": [
    {"url": "http://proxy1.com:8080", "name": "代理1"},
    {"url": "http://proxy2.com:8080", "name": "代理2"},
    {"url": "http://proxy3.com:8080", "name": "代理3"}
  ],
  ...
}
```

或者在管理后台的"代理配置"页面进行配置。

### Docker 部署

参考 `DOCKER_DEPLOY.md` 文件。

## 目录结构

```
droid2api/
├── server.js                 # 主服务器文件
├── config.js                 # 配置管理
├── config.json              # 配置文件
├── routes.js                # API 路由
├── admin-routes.js          # 管理后台 API 路由
├── auth.js                  # 认证系统
├── api-key-auth.js          # API Key 认证中间件
├── factory-key-manager.js   # Factory Key 管理器
├── usage-tracker.js         # 使用统计
├── pricing.js               # 价格计算
├── data-store.js            # 数据存储
├── proxy-manager.js         # 代理管理器
├── logger.js                # 日志系统
├── public/                  # 管理后台前端
│   ├── admin.html
│   └── admin.js
├── data/                    # 运行时数据（自动生成）
│   ├── factory-keys.json
│   ├── api-keys.json
│   ├── usage-log.json
│   └── error-log.json
└── transformers/            # 请求/响应转换器
    ├── request-anthropic.js
    ├── request-openai.js
    ├── request-common.js
    ├── response-anthropic.js
    └── response-openai.js
```

## 环境变量

支持以下环境变量：

- `ADMIN_USERNAME`: 管理员用户名（覆盖 config.json）
- `ADMIN_PASSWORD`: 管理员密码（覆盖 config.json）
- `FACTORY_API_KEY`: 单个 Factory Key（已弃用，建议使用管理后台添加）
- `DROID_REFRESH_KEY`: Refresh token（可选）

## 生产环境部署建议

### 1. 使用进程管理器

使用 PM2：

```bash
npm install -g pm2
pm2 start server.js --name droid2api
pm2 save
pm2 startup
```

### 2. 反向代理

使用 Nginx 配置：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # API 接口
    location /v1/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # 管理后台（限制访问 IP）
    location /admin/ {
        allow 192.168.1.0/24;  # 允许内网访问
        deny all;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 管理后台 API（同样限制访问）
    location /api/admin/ {
        allow 192.168.1.0/24;
        deny all;
        
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### 3. HTTPS 配置

使用 Let's Encrypt：

```bash
apt install certbot python3-certbot-nginx
certbot --nginx -d your-domain.com
```

### 4. 定期备份

创建备份脚本 `backup.sh`：

```bash
#!/bin/bash
BACKUP_DIR="/backup/droid2api"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR
tar -czf $BACKUP_DIR/data_$DATE.tar.gz data/
tar -czf $BACKUP_DIR/config_$DATE.tar.gz config.json

# 保留最近30天的备份
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete
```

添加到 crontab：

```bash
0 2 * * * /path/to/backup.sh
```

### 5. 监控

使用 PM2 监控：

```bash
pm2 monit
```

或配置日志收集系统。

## 故障排除

### 端口被占用

修改 `config.json` 中的 `port` 配置：

```json
{
  "port": 3001,
  ...
}
```

### 管理后台无法访问

检查：
1. 服务是否正常启动
2. 防火墙是否放行端口
3. 浏览器控制台是否有错误

### API 认证失败

检查：
1. API Key 是否在管理后台中添加
2. API Key 是否启用
3. 是否超过每日请求限制

### Factory Key 全部失败

在管理后台点击"重置所有失败"按钮，或者添加新的 Factory Key。

## 更新升级

```bash
# 备份数据
cp -r data data.backup

# 拉取最新代码
git pull

# 安装依赖
npm install

# 重启服务
pm2 restart droid2api
```

## 技术支持

如遇问题，请查看：
- `data/error-log.json` 错误日志
- 控制台输出
- 管理后台的错误日志页面

