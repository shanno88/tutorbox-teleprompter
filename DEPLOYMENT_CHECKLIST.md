# 播感大师 Paddle 支付集成部署清单

## 前置准备

### 1. Paddle Dashboard 配置

登录 [Paddle Dashboard](https://vendors.paddle.com/)，完成以下配置：

#### 1.1 创建产品

- 进入 Products → Create Product
- 创建两个产品：

**产品 1：月度 Pro**
- Name: 月度 Pro
- Description: 播感大师月度订阅
- Price Type: Recurring
- Billing Cycle: Monthly
- Amount: $29
- Currency: USD

**产品 2：年度 Pro**
- Name: 年度 Pro
- Description: 播感大师年度订阅
- Price Type: Recurring
- Billing Cycle: Yearly
- Amount: ¥199
- Currency: CNY

#### 1.2 获取凭证

- 进入 Developer → Authentication
- 记录以下信息：
  - Vendor ID
  - API Key
  - Public Key
  - Webhook Secret

#### 1.3 配置 Webhook

- 进入 Developer → Webhooks → Create Webhook
- Webhook URL: `https://yourdomain.com/api/paddle/webhook`
- 选择以下事件：
  - `subscription.created`
  - `subscription.updated`
  - `subscription.cancelled`
  - `subscription.payment_succeeded`
  - `subscription.payment_failed`
  - `transaction.completed`

## 环境变量配置

### 2. 创建 .env 文件

在项目根目录创建 `.env` 文件，填入 Paddle 凭证：

```env
# Paddle 配置
PADDLE_VENDOR_ID=your_vendor_id_here
PADDLE_API_KEY=your_api_key_here
PADDLE_PUBLIC_KEY=your_public_key_here
PADDLE_WEBHOOK_SECRET=your_webhook_secret_here

# 产品 ID
PADDLE_PRODUCT_ID_MONTHLY=your_monthly_product_id_here
PADDLE_PRODUCT_ID_YEARLY=your_yearly_product_id_here

# 环境设置
NODE_ENV=production
```

### 3. 安装依赖

```bash
# 后端依赖
npm install cookie-parser dotenv

# 前端依赖
npm install @paddle/paddle-js
npm install @reduxjs/toolkit react-redux
```

## 代码修改

### 4. 修改 server.js

添加以下中间件和路由：

```javascript
import cookieParser from 'cookie-parser';
import paddleRouter from './routes/paddle.js';

// 在 app.use(cors()) 后添加
app.use(cookieParser());

// 在启动服务器前添加
app.use('/api/paddle', paddleRouter);
```

### 5. 修改 src/main.jsx

在应用外层包裹 Redux Provider：

```javascript
import { Provider } from 'react-redux';
import store from './store';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);
```

### 6. 修改 src/App.tsx

按照 INTEGRATION_GUIDE.js 的指引：
1. 删除 LicenseService 相关代码
2. 添加 Redux 相关导入
3. 添加订阅状态管理
4. 修改 checkPermission 函数
5. 添加订阅按钮和弹窗组件

## 数据库配置（可选）

当前实现使用内存存储，生产环境建议使用数据库：

### 7. 使用 MongoDB 示例

修改 `routes/paddle.js`，替换内存存储：

```javascript
const mongoose = require('mongoose');

// 用户模型
const UserSchema = new mongoose.Schema({
  userId: { type: String, unique: true },
  isPro: { type: Boolean, default: false },
  planType: { type: String, enum: ['monthly', 'yearly'] },
  subscriptionId: String,
  subscriptionEnd: Date,
  trialEnd: Date,
  dailyCreditsUsed: { type: Number, default: 0 },
  dailyCreditsLimit: { type: Number, default: 10 },
  lastCreditReset: Date
});

const User = mongoose.model('User', UserSchema);

// 修改存储函数
async function getUserData(userId) {
  return await User.findOne({ userId });
}

async function saveUserData(userId, userData) {
  await User.findOneAndUpdate(
    { userId },
    { $set: userData },
    { upsert: true, new: true }
  );
}
```

在 server.js 中连接数据库：

```javascript
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-teleprompter')
  .then(() => console.log('MongoDB 已连接'))
  .catch(err => console.error('MongoDB 连接失败:', err));
```

## 部署步骤

### 8. 构建前端

```bash
npm run build
```

### 9. 启动后端

```bash
# 加载环境变量
node -r dotenv/config server.js
```

### 10. 配置反向代理（Nginx 示例）

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # 前端静态文件
    location / {
        root /path/to/dist;
        try_files $uri $uri/ /index.html;
    }

    # 后端 API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Paddle Webhook（不需要缓存）
    location /api/paddle/webhook {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

## 测试检查清单

### 11. 功能测试

- [ ] 新用户注册后能看到 3 天试用状态
- [ ] 试用期内每天限制 10 个点数
- [ ] 点击"升级 Pro"能打开 Paddle checkout
- [ ] 完成支付后自动激活 Pro 会员
- [ ] Pro 用户无限制使用所有功能
- [ ] 订阅状态正确显示（到期时间等）
- [ ] 点数用完后提示升级

### 12. 支付测试

- [ ] 测试环境（sandbox）支付流程
- [ ] 月度订阅支付
- [ ] 年度订阅支付
- [ ] 取消订阅流程
- [ ] 续费流程

### 13. Webhook 测试

- [ ] subscription.created 事件正确处理
- [ ] subscription.updated 事件正确处理
- [ ] subscription.cancelled 事件正确处理
- [ ] subscription.payment_succeeded 事件正确处理
- [ ] Webhook 签名验证正常

## 监控与日志

### 14. 添加日志

```javascript
// 在 server.js 中添加请求日志
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});
```

### 15. 错误监控

建议使用 Sentry 或类似工具监控错误：

```bash
npm install @sentry/node
```

```javascript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

## 上线检查清单

- [ ] 所有环境变量已正确配置
- [ ] Paddle 产品和价格已创建
- [ ] Webhook URL 已配置并可访问
- [ ] 数据库（如果使用）已连接
- [ ] SSL 证书已配置（HTTPS）
- [ ] 反向代理已配置
- [ ] 监控和日志已设置
- [ ] 备份策略已制定
- [ ] 客服联系方式已更新（移除手动支付相关）
- [ ] 用户协议和隐私政策已更新（包含支付条款）

## 回滚计划

如果出现问题，可以快速回滚：

1. 停止新版本服务
2. 切换回旧版本代码
3. 恢复数据库备份
4. 通知用户系统维护

## 注意事项

1. **Webhook 安全**：确保 Webhook URL 使用 HTTPS，并验证签名
2. **数据持久化**：生产环境必须使用数据库，不能依赖内存存储
3. **支付流程**：测试环境使用 sandbox，上线前切换到生产环境
4. **用户体验**：在支付过程中提供清晰的指引和反馈
5. **法律合规**：确保符合相关地区的支付法规（GDPR、CCPA 等）
6. **客服支持**：准备好支付问题的客服支持流程

## 常见问题

### Q: 用户支付后没有自动激活？
A: 检查 Webhook 是否正常接收事件，查看后端日志

### Q: 点数没有正确消耗？
A: 检查 `/api/paddle/consume-credit` 接口是否正常调用

### Q: 如何测试支付流程？
A: 在 Paddle Dashboard 中创建测试支付，使用测试卡号

### Q: 如何退款？
A: 在 Paddle Dashboard 中可以手动处理退款

## 联系支持

如果遇到问题：
- Paddle 文档：https://developer.paddle.com/
- 技术支持：[your-email]
- 紧急联系：[your-phone]
