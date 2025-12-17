# Railway 部署检查清单

## ✅ 已完成的配置

- [x] 创建 `railway.json` 配置文件
- [x] 创建 `Procfile` 启动文件
- [x] 添加 `start:server` 脚本到 `package.json`
- [x] 更新服务器代码支持环境变量配置
- [x] 支持 `ALLOWED_ORIGINS` 环境变量（多个域名用逗号分隔）

## 📋 部署步骤

### 1. 推送代码到 GitHub
```bash
git add .
git commit -m "准备 Railway 部署"
git push
```

### 2. 在 Railway 创建项目

1. 访问 https://railway.app
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 选择你的仓库

### 3. 配置环境变量

在 Railway 项目设置 → Variables 中添加：

```
PORT=3009
HOST=0.0.0.0
FRONTEND_URL=https://your-frontend.vercel.app
```

**或者使用 ALLOWED_ORIGINS（推荐）：**
```
PORT=3009
HOST=0.0.0.0
ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-custom-domain.com
```

### 4. 等待部署完成

Railway 会自动：
- 安装依赖 (`npm install`)
- 启动服务器 (`node server/index.js`)

### 5. 获取后端 URL

部署成功后，Railway 会提供类似这样的 URL：
```
https://your-app.up.railway.app
```

### 6. 更新前端环境变量

在 Vercel 项目设置中添加：
```
NEXT_PUBLIC_SERVER_URL=https://your-app.up.railway.app
```

## 🔍 验证部署

访问后端 URL：
```
https://your-app.up.railway.app
```

应该看到 JSON 响应：
```json
{
  "name": "Party Buzzer API",
  "version": "1.0.0",
  "websocket": "wss://your-app.up.railway.app",
  "frontend": "https://your-frontend.vercel.app"
}
```

## ⚠️ 重要提示

1. **数据库持久化**：SQLite 文件在 Railway 重启后会丢失，建议迁移到 PostgreSQL
2. **HTTPS**：Railway 自动提供 HTTPS，WebSocket 会自动升级为 WSS
3. **日志**：在 Railway Dashboard 可以查看实时日志
4. **免费额度**：Railway 提供 $5/月免费额度，通常足够小型项目使用

## 🐛 故障排查

### 服务无法启动
- 检查 Railway 日志
- 确认 `PORT` 环境变量已设置
- 确认所有依赖已正确安装

### WebSocket 连接失败
- 确认前端 URL 在 `ALLOWED_ORIGINS` 中
- 检查 CORS 配置
- 确认使用 HTTPS/WSS

### 数据库问题
- 考虑使用 Railway 的 PostgreSQL 服务
- 或使用外部数据库（Supabase、MongoDB Atlas）


