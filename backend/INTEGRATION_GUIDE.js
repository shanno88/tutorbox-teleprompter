// 在 App.tsx 顶部添加这些导入

import { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import store from './store';
import { setSubscriptionStatus, incrementCreditsUsed } from './store/subscriptionSlice';
import SubscriptionButton from './components/SubscriptionButton';
import UpgradeModal from './components/UpgradeModal';

// 在 App 组件内部，添加以下代码

function App() {
  const dispatch = useDispatch();
  const subscription = useSelector(state => state.subscription);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // 初始化：加载订阅状态
  useEffect(() => {
    const loadSubscriptionStatus = async () => {
      try {
        const res = await fetch('/api/paddle/status');
        const data = await res.json();
        dispatch(setSubscriptionStatus(data));
      } catch (error) {
        console.error('加载订阅状态失败:', error);
      }
    };

    loadSubscriptionStatus();
  }, [dispatch]);

  // 检查权限并消耗点数
  const checkPermissionAndConsume = async () => {
    try {
      const res = await fetch('/api/paddle/consume-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credits: 1 })
      });

      const data = await res.json();

      if (data.success) {
        dispatch(incrementCreditsUsed());
        return true;
      } else {
        if (data.error === '试用已过期' || data.error === '今日点数已用完') {
          setShowUpgradeModal(true);
        } else {
          alert(data.error);
        }
        return false;
      }
    } catch (error) {
      console.error('检查权限失败:', error);
      setShowUpgradeModal(true);
      return false;
    }
  };

  // 处理订阅
  const handleSubscribe = async (planType) => {
    try {
      const res = await fetch('/api/paddle/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType })
      });

      const data = await res.json();

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data.error) {
        alert(data.error);
      }
    } catch (error) {
      console.error('订阅失败:', error);
      alert('订阅失败，请稍后重试');
    }
  };

  // 修改原有的 checkPermission 函数
  const checkPermission = async () => {
    // Pro 用户直接通过
    if (subscription.isPro) return true;

    // 检查试用和点数
    const success = await checkPermissionAndConsume();
    if (!success) {
      setShowUpgradeModal(true);
    }
    return success;
  };

  // 在 JSX 中添加订阅按钮和弹窗
  // 找到合适的位置添加：

  // 1. 在导航栏或工具栏添加订阅按钮
  <div className="flex items-center gap-2">
    <SubscriptionButton
      subscription={subscription}
      onUpgrade={() => setShowUpgradeModal(true)}
    />
  </div>

  // 2. 在弹窗部分添加升级弹窗
  <UpgradeModal
    isOpen={showUpgradeModal}
    onClose={() => setShowUpgradeModal(false)}
    onSubscribe={handleSubscribe}
  />

  // 3. 修改 AI 功能调用，使用新的 checkPermission
  const callContrabandCheck = async () => {
    playClickSound();

    // 检查权限
    const hasPermission = await checkPermission();
    if (!hasPermission) return;

    // ... 原有逻辑
  };

  const callRewrite = async () => {
    playClickSound();

    const hasPermission = await checkPermission();
    if (!hasPermission) return;

    // ... 原有逻辑
  };

  const callProsodyAnnotation = async () => {
    playClickSound();

    const hasPermission = await checkPermission();
    if (!hasPermission) return;

    // ... 原有逻辑
  };
}
