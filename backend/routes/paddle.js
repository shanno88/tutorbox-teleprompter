import express from 'express';
import crypto from 'crypto';

const router = express.Router();

// 内存存储（实际应该使用数据库）
const users = new Map();

// 生成用户 ID
function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

// 获取用户数据
function getUserData(userId) {
  return users.get(userId);
}

// 保存用户数据
function saveUserData(userId, userData) {
  users.set(userId, userData);
}

// Paddle Webhook 签名验证
function verifyPaddleSignature(body, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  const digest = hmac.digest('hex');
  return digest === signature;
}

// 获取 Paddle checkout URL
router.post('/checkout', async (req, res) => {
  console.log('========== /api/paddle/checkout START ==========');
  console.log('📥 请求 Body:', JSON.stringify(req.body, null, 2));
  console.log('🍪 Cookie userId:', req.cookies.userId);
  console.log('🔧 环境变量检查:');
  console.log('   - PADDLE_PRICE_ID_MONTHLY:', process.env.PADDLE_PRICE_ID_MONTHLY || '(未设置)');
  console.log('   - PADDLE_PRICE_ID_YEARLY:', process.env.PADDLE_PRICE_ID_YEARLY || '(未设置)');
  console.log('   - PADDLE_PRODUCT_ID_MONTHLY:', process.env.PADDLE_PRODUCT_ID_MONTHLY || '(未设置)');
  console.log('   - PADDLE_PRODUCT_ID_YEARLY:', process.env.PADDLE_PRODUCT_ID_YEARLY || '(未设置)');
  console.log('   - NODE_ENV:', process.env.NODE_ENV || '(未设置)');

  try {
    const { planType, userId } = req.body;

    console.log('📝 创建 Checkout:', { planType, userId, hasCookie: !!req.cookies.userId });

    // Paddle Billing 使用 priceId（价格ID），不是 productId
    // 优先使用 PADDLE_PRICE_ID_*，兼容旧的 PADDLE_PRODUCT_ID_* 命名
    const priceIds = {
      monthly: process.env.PADDLE_PRICE_ID_MONTHLY || process.env.PADDLE_PRODUCT_ID_MONTHLY,
      yearly: process.env.PADDLE_PRICE_ID_YEARLY || process.env.PADDLE_PRODUCT_ID_YEARLY
    };

    console.log('🔍 解析后的 priceIds:', JSON.stringify(priceIds));

    const priceId = priceIds[planType];
    console.log('🎯 选中的 priceId:', priceId);
    
    if (!planType || !['monthly', 'yearly'].includes(planType)) {
      console.error('❌ 无效的计划类型:', planType);
      return res.status(400).json({ 
        success: false, 
        error: '无效的计划类型，请选择 monthly 或 yearly' 
      });
    }

    if (!priceId) {
      console.error('❌ 缺少价格 ID，请检查环境变量 PADDLE_PRICE_ID_MONTHLY 或 PADDLE_PRICE_ID_YEARLY');
      console.error('❌ 当前 priceIds 对象:', JSON.stringify(priceIds));
      return res.status(500).json({ 
        success: false, 
        error: '服务器配置错误：缺少价格配置，请联系管理员' 
      });
    }

    // 生成用户 ID（如果未提供）
    const customerId = userId || req.cookies.userId || generateUserId();

    console.log('✅ Checkout 数据:', { priceId, customerId });

    // 设置 cookie（用于识别用户）
    res.cookie('userId', customerId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 365 * 24 * 60 * 60 * 1000 // 1 年
    });

    // 返回价格 ID，前端直接用 Paddle.js 打开 checkout
    console.log('========== /api/paddle/checkout SUCCESS ==========');
    res.json({
      success: true,
      priceId: priceId,
      customerId: customerId,
      customerEmail: 'tutorbox@qiyoga.xyz'
    });
  } catch (error) {
    console.error('========== /api/paddle/checkout ERROR ==========');
    console.error('❌ 创建 checkout 失败:', error);
    console.error('❌ Error message:', error.message);
    console.error('❌ Error stack:', error.stack);
    if (error.response) {
      console.error('❌ Error response data:', error.response.data);
      console.error('❌ Error response status:', error.response.status);
    }
    res.status(500).json({ 
      success: false, 
      error: '服务器错误，请稍后重试',
      details: error.message
    });
  }
});

// Paddle Webhook 处理
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // 验证签名
    const signature = req.headers['paddle-signature'];
    const isValid = verifyPaddleSignature(req.body.toString(), signature, process.env.PADDLE_WEBHOOK_SECRET);

    if (!isValid) {
      console.error('❌ Webhook 签名验证失败');
      return res.status(401).send('Invalid signature');
    }

    // 解析事件
    const event = JSON.parse(req.body);

    // 增强：更详细的日志
    console.log('📬 收到 Paddle Webhook:', {
      eventType: event.event_type,
      eventId: event.event_id,
      userId: event.data?.custom_data?.userId || event.data?.customData?.userId
    });

    const { data } = event;
    const userId = data.custom_data?.userId || data.customData?.userId;

    if (!userId) {
      console.error('❌ Webhook 缺少 userId');
      return res.status(400).send('Missing userId');
    }

    // 根据事件类型处理
    switch (event.event_type) {
      case 'subscription.created':
      case 'subscription.activated':
        await handleSubscriptionActivated(userId, data);
        break;

      case 'subscription.updated':
        await handleSubscriptionUpdated(userId, data);
        break;

      case 'subscription.cancelled':
        await handleSubscriptionCancelled(userId, data);
        break;

      case 'subscription.payment_succeeded':
        await handlePaymentSucceeded(userId, data);
        break;

      case 'subscription.payment_failed':
        await handlePaymentFailed(userId, data);
        break;

      case 'transaction.completed':
        await handleTransactionCompleted(userId, data);
        break;

      default:
        console.log('ℹ️  未处理的事件类型:', event.event_type);
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('❌ Webhook 处理失败:', error);
    res.status(500).send('Internal Server Error');
  }
});

// 查询订阅状态
router.get('/status', async (req, res) => {
  try {
    const userId = req.cookies.userId;

    if (!userId) {
      // 新用户，返回试用状态
      const newUserId = generateUserId();
      const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      // 初始化新用户
      saveUserData(newUserId, {
        isPro: false,
        trialEnd: trialEnd.toISOString(),
        dailyCreditsUsed: 0,
        dailyCreditsLimit: 10,
        lastCreditReset: new Date().toDateString()
      });

      res.cookie('userId', newUserId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 365 * 24 * 60 * 60 * 1000
      });

      return res.json({
        isPro: false,
        planType: null,
        subscriptionEnd: null,
        trialEnd: trialEnd.toISOString(),
        dailyCreditsUsed: 0,
        dailyCreditsLimit: 10,
        isNewUser: true
      });
    }

    // 从存储中获取用户订阅信息
    let user = getUserData(userId);

    if (!user) {
      // 用户不存在，初始化试用状态
      const trialEnd = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      user = {
        isPro: false,
        trialEnd: trialEnd.toISOString(),
        dailyCreditsUsed: 0,
        dailyCreditsLimit: 10,
        lastCreditReset: new Date().toDateString()
      };
      saveUserData(userId, user);
    }

    // 检查订阅是否过期
    const isProActive = user.isPro && user.subscriptionEnd && new Date(user.subscriptionEnd) > new Date();

    // 检查试用是否过期
    const trialEnd = user.trialEnd || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const isTrialActive = new Date(trialEnd) > new Date();

    // 检查是否需要重置每日点数
    const today = new Date().toDateString();
    if (user.lastCreditReset !== today) {
      user.dailyCreditsUsed = 0;
      user.lastCreditReset = today;
      saveUserData(userId, user);
    }

    res.json({
      isPro: isProActive,
      planType: user.planType || null,
      subscriptionEnd: user.subscriptionEnd || null,
      trialEnd: trialEnd,
      dailyCreditsUsed: user.dailyCreditsUsed || 0,
      dailyCreditsLimit: isProActive ? Infinity : 10,
      isNewUser: false
    });
  } catch (error) {
    console.error('❌ 查询订阅状态失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 消耗点数
router.post('/consume-credit', async (req, res) => {
  try {
    const userId = req.cookies.userId;
    const { credits = 1 } = req.body;

    if (!userId) {
      return res.status(401).json({ error: '未登录' });
    }

    const user = getUserData(userId);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 检查是否是 Pro 用户
    if (user.isPro && user.subscriptionEnd && new Date(user.subscriptionEnd) > new Date()) {
      // Pro 用户无限制
      return res.json({ success: true, remaining: Infinity });
    }

    // 检查试用是否过期
    const trialEnd = user.trialEnd || new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    if (new Date(trialEnd) <= new Date()) {
      return res.status(403).json({ error: '试用已过期，请升级到 Pro' });
    }

    // 检查每日点数
    const today = new Date().toDateString();
    if (user.lastCreditReset !== today) {
      user.dailyCreditsUsed = 0;
      user.lastCreditReset = today;
    }

    if (user.dailyCreditsUsed >= (user.dailyCreditsLimit || 10)) {
      return res.status(403).json({
        error: '今日点数已用完',
        remaining: 0
      });
    }

    // 消耗点数
    user.dailyCreditsUsed += credits;
    saveUserData(userId, user);

    res.json({
      success: true,
      used: user.dailyCreditsUsed,
      remaining: (user.dailyCreditsLimit || 10) - user.dailyCreditsUsed
    });
  } catch (error) {
    console.error('❌ 消耗点数失败:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// ========== Webhook 事件处理函数 ==========

async function handleSubscriptionActivated(userId, data) {
  console.log(`✅ 用户 ${userId} 订阅已激活`);

  const planType = data.items?.[0]?.price?.billing_cycle?.interval === 'month' ? 'monthly' : 'yearly';
  const subscriptionEnd = new Date(data.next_billed_at || data.scheduled_change?.effective_at);

  const user = getUserData(userId) || {};
  user.isPro = true;
  user.planType = planType;
  user.subscriptionId = data.id;
  user.subscriptionEnd = subscriptionEnd.toISOString();

  saveUserData(userId, user);
}

async function handleSubscriptionUpdated(userId, data) {
  console.log(`🔄 用户 ${userId} 订阅已更新`);

  const user = getUserData(userId);
  if (!user) return;

  user.subscriptionEnd = new Date(data.next_billed_at || data.scheduled_change?.effective_at).toISOString();
  saveUserData(userId, user);
}

async function handleSubscriptionCancelled(userId, data) {
  console.log(`❌ 用户 ${userId} 订阅已取消`);

  const user = getUserData(userId);
  if (!user) return;

  user.subscriptionEnd = data.canceled_at || data.cancelled_at;
  saveUserData(userId, user);
}

async function handlePaymentSucceeded(userId, data) {
  console.log(`💰 用户 ${userId} 支付成功`);
  // 可以在这里发送支付成功通知
}

async function handlePaymentFailed(userId, data) {
  console.log(`❌ 用户 ${userId} 支付失败`);
  // 可以在这里发送支付失败提醒
}

async function handleTransactionCompleted(userId, data) {
  console.log(`✅ 用户 ${userId} 交易完成`);

  const user = getUserData(userId) || {};
  user.lastPayment = new Date().toISOString();
  saveUserData(userId, user);
}

export default router;
