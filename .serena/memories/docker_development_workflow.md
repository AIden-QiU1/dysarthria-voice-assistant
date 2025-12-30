# 开发环境规范 - Docker优先

## 核心原则

**不要在系统环境安装包**
- ❌ apt install redis-server
- ❌ npm install -g xxx
- ❌ pip install xxx (系统级)
- ✅ 使用Docker Compose管理所有服务

## 项目Docker架构

```yaml
services:
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  
  backend:
    build: ./backend
    ports: ["3001:3001"]
    depends_on: [redis]
  
  ten-agent-worker:
    build: ./ten_agent
    deploy:
      replicas: 3
    depends_on: [redis]
  
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
```

## 开发工作流

### 使用Serena理解代码
```
mcp_serena_get_symbols_overview(relative_path="...")
mcp_serena_find_symbol(name_path_pattern="...")
mcp_serena_search_for_pattern(substring_pattern="...")
```

### 使用终端命令
```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f backend

# 进入容器
docker-compose exec backend sh

# 停止服务
docker-compose down
```

### 文件创建
- 使用create_file工具
- 或在容器内操作

## 当前已安装的系统包

**需要清理**：
- redis-server (已安装，应使用Docker Redis代替)

**保留**：
- Node.js 18 (开发需要)
- Python 3.10 (开发需要)
- Git (开发需要)

## Docker Compose配置位置

- `/root/VoxFlame-Agent/docker-compose.yml`
- `/root/VoxFlame-Agent/backend/Dockerfile`
- `/root/VoxFlame-Agent/ten_agent/Dockerfile`
- `/root/VoxFlame-Agent/frontend/Dockerfile`
