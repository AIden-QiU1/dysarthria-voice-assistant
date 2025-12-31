# VoxFlame Agent 部署指南

## 快速启动（Docker Compose）

### 1. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑.env文件，填入真实的API密钥
nano .env
```

必需的环境变量：
- `SUPABASE_URL`: Supabase项目URL
- `SUPABASE_ANON_KEY`: Supabase匿名密钥
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase服务密钥
- `DASHSCOPE_API_KEY`: 阿里云DashScope API密钥（用于GLM-4、CosyVoice、Embedding）
- `ALIBABA_APP_KEY`: 阿里云应用密钥
- `ALIBABA_ACCESS_KEY_ID`: 阿里云AccessKeyId
- `ALIBABA_ACCESS_KEY_SECRET`: 阿里云AccessKeySecret

### 2. 启动所有服务
```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f

# 检查服务状态
docker-compose ps
```

### 3. 验证服务

**Backend API (端口3001)**:
```bash
curl http://localhost:3001/health
# 预期输出: {"status":"ok"}
```

**TEN Agent WebSocket (端口8765)**:
```bash
# 需要WebSocket客户端测试
```

**OceanBase (端口2881)**:
```bash
docker exec -it voxflame-oceanbase mysql -h127.0.0.1 -P2881 -uroot -proot -e "SHOW DATABASES;"
```

### 4. 停止服务
```bash
# 停止所有容器
docker-compose down

# 停止并删除volumes
docker-compose down -v
```

## 服务架构

```
┌─────────────┐     HTTP      ┌──────────────┐
│  Frontend   │◄─────────────►│   Backend    │
│  (Next.js)  │               │  (Express)   │
└─────────────┘               └──────┬───────┘
                                     │
                              ┌──────┴───────┐
                              │   Supabase   │
                              │  (PostgreSQL)│
                              └──────────────┘
                                     
┌─────────────┐   WebSocket   ┌──────────────┐
│   Client    │◄─────────────►│  TEN Agent   │
│  (Browser)  │               │  (Python)    │
└─────────────┘               └──────┬───────┘
                                     │
                              ┌──────┴───────┐
                              │  OceanBase   │
                              │  (PowerMem)  │
                              └──────────────┘
```

## 端口映射

| 服务 | 容器内端口 | 宿主机端口 | 用途 |
|------|-----------|-----------|------|
| Backend | 3001 | 3001 | REST API |
| TEN Agent | 8765 | 8765 | WebSocket (语音流) |
| TEN Agent | 8080 | 8080 | HTTP API |
| OceanBase | 2881 | 2881 | MySQL协议 |
| OceanBase | 2886 | 2886 | RPC |

## 故障排查

### OceanBase启动失败
```bash
# 检查日志
docker logs voxflame-oceanbase

# 增加内存限制（如果需要）
docker-compose down
# 编辑docker-compose.yml，增加memory限制
docker-compose up -d
```

### Backend连接Supabase失败
```bash
# 检查环境变量
docker exec voxflame-backend env | grep SUPABASE

# 手动测试连接
docker exec -it voxflame-backend curl -H "apikey: $SUPABASE_ANON_KEY" $SUPABASE_URL/rest/v1/
```

### TEN Agent依赖安装失败
```bash
# 重新构建镜像
docker-compose build --no-cache ten-agent

# 查看详细日志
docker-compose up ten-agent
```

## 开发模式

如果需要本地开发而不使用Docker：

### Backend
```bash
cd backend
npm install
npm run build
npm start
```

### TEN Agent
```bash
cd ten_agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python -m ten.start --config property.json
```

## 生产环境注意事项

1. **修改默认密码**: OceanBase的root密码应修改为强密码
2. **配置HTTPS**: 使用Nginx反向代理，配置SSL证书
3. **启用日志收集**: 集成ELK或Grafana Loki
4. **监控告警**: 配置Prometheus + Grafana
5. **备份策略**: 定期备份OceanBase和Supabase数据
6. **资源限制**: 为每个服务配置合理的CPU和内存限制

