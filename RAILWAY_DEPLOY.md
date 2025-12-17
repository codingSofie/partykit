# Railway 部署指南

## 快速开始

### 1. 准备 GitHub 仓库

确保你的代码已推送到 GitHub。

### 2. 在 Railway 创建项目

1. 访问 [Railway](https://railway.app)
2. 点击 "New Project"
3. 选择 "Deploy from GitHub repo"
4. 授权 Railway 访问你的 GitHub 账户
5. 选择你的仓库

### 3. 配置部署设置

Railway 会自动检测到 Node.js 项目，但需要手动配置：

#### 设置根目录（如果需要）
- 如果整个项目在根目录，无需设置
- 如果只有后端代码在子目录，设置 Root Directory 为 `server/`

#### 设置启动命令
Railway 会自动使用 `Procfile` 或 `package.json` 中的 `start:server` 脚本

### 4. 配置环境变量

在 Railway 项目设置中添加以下环境变量：

```
PORT=3009
HOST=0.0.0.0
FRONTEND_URL=https://your-frontend.vercel.app
```

**重要**：将 `FRONTEND_URL` 替换为你实际的前端 Vercel 部署地址。

如果需要允许多个前端域名，可以使用：
```
ALLOWED_ORIGINS=https://your-app.vercel.app,https://your-custom-domain.com
```

### 5. 部署

Railway 会自动：
1. 检测到 `package.json`
2. 运行 `npm install`
3. 使用 `Procfile` 或 `start:server` 启动服务器

### 6. 获取后端 URL

部署成功后，Railway 会提供一个公共 URL，例如：
- `https://your-app.up.railway.app`

### 7. 更新前端环境变量

在 Vercel 项目中设置：
```
NEXT_PUBLIC_SERVER_URL=https://your-app.up.railway.app
```

## 数据库注意事项

⚠️ **重要**：Railway 的临时文件系统会在服务重启时清空 SQLite 数据库。

### 解决方案：

1. **使用 Railway 的 PostgreSQL（推荐）**
   - 在 Railway 项目中添加 PostgreSQL 服务
   - 修改 `server/db.js` 使用 PostgreSQL
   - 数据会持久化保存

2. **使用 Railway Volume（临时方案）**
   - 在 Railway 中添加 Volume
   - 将数据库文件存储在 Volume 中
   - 注意：Volume 在服务删除时会丢失

3. **使用外部数据库服务**
   - Supabase（免费 PostgreSQL）
   - MongoDB Atlas（免费层）
   - PlanetScale（免费 MySQL）

## 监控和日志

- Railway 提供实时日志查看
- 可以在 Railway Dashboard 中查看服务状态
- 支持自动重启和健康检查

## 自定义域名（可选）

1. 在 Railway 项目设置中添加自定义域名
2. 更新 `FRONTEND_URL` 环境变量
3. 更新 Vercel 的 `NEXT_PUBLIC_SERVER_URL`

## 故障排查

### 服务无法启动
- 检查日志中的错误信息
- 确认 `PORT` 环境变量已设置
- 确认所有依赖已安装

### WebSocket 连接失败
- 确认前端 URL 已添加到 `FRONTEND_URL` 或 `ALLOWED_ORIGINS`
- 检查 CORS 配置
- 确认 Railway URL 使用 HTTPS

### 数据库问题
- 检查数据库文件路径
- 考虑迁移到 PostgreSQL

## 费用

Railway 提供：
- **免费层**：$5 免费额度/月
- **付费层**：按使用量计费

对于小型项目，免费层通常足够使用。


