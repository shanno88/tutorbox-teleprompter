import { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Play, Pause, RotateCcw, Type, Gauge, Monitor, X, Wand2, Star, GripVertical, PauseCircle, Loader2, CircleHelp, Volume2, Settings2, RefreshCw, AlertTriangle, Info, AlertCircle, ShoppingBag, GraduationCap, ChevronRight, ChevronDown, Speaker, ArrowUpRight, ArrowDownRight, Mic, ShieldCheck, Eraser, Clock, Zap, Save, FileText, Sparkles, Code, Film, Image as ImageIcon } from 'lucide-react';
import { setSubscriptionStatus, incrementCreditsUsed } from './store/subscriptionSlice';
import SubscriptionButton from './components/SubscriptionButton';
import UpgradeModal from './components/UpgradeModal';
import { initializePaddle } from '@paddle/paddle-js';

// --- 简单的音效生成器 ---
const playClickSound = () => {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(600, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.15);

    gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.15);
  } catch (e) {
    // console.error("Audio play failed", e);
  }
};

// --- 自定义弹窗组件 ---
const CustomModal = ({ isOpen, type, content, onConfirm, onClose, children }: any) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 scale-100 animate-in zoom-in-95 duration-200 border border-gray-100">
        <div className="flex flex-col items-center text-center">
          {type && (
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${type === 'confirm' ? 'bg-yellow-100 text-yellow-600' : 'bg-indigo-100 text-indigo-600'}`}>
              {type === 'confirm' ? <AlertCircle size={24} /> : <Info size={24} />}
            </div>
          )}
          {type && (
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {type === 'confirm' ? '请确认' : '提示'}
            </h3>
          )}
          {content && (
            <div className="text-gray-600 mb-6 text-sm leading-relaxed whitespace-pre-wrap text-left w-full">
              {content}
            </div>
          )}
          {children} {/* 支持自定义内容 */}

          {(onConfirm || (type === 'confirm' || type === 'alert')) && (
            <div className="flex gap-3 w-full mt-4">
              {type === 'confirm' && (
                <button
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
              )}
              <button
                onClick={() => {
                  if (onConfirm) onConfirm();
                  onClose();
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 ${type === 'confirm' ? 'bg-black hover:bg-gray-800' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
              >
                {type === 'confirm' ? '确认执行' : '知道了'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- 默认改写规则 ---
const DEFAULT_REWRITE_RULES = {
  sales: `1. 【留人】：用夸张或引起好奇的开头抓住注意力。
2. 【价值】：清晰阐述产品核心卖点和价值。
3. 【比价】：通过对比凸显价格优势。
4. 【保障】：强调售后或品质保障，消除顾虑。
5. 【稀缺】：制造紧迫感，催促下单。`,
  course: `1. 【放钩子】：用利益点或颠覆性认知吸引停留。
2. 【讲痛点】：戳中用户焦虑或当前困境。
3. 【讲人设】：展示你的专业身份或成功案例，建立信任。
4. 【讲试题/干货】：抛出部分高价值内容或试题，展示课程含金量。
5. 【讲进群】：引导用户加入社群或点击链接。
6. 【发福袋】：用限时福利或资料包作为临门一脚。`,
  // 【修改】短视频逻辑默认规则（与卖货逻辑一致的 5 步结构）
  'short-video': `1. 【留人】：用夸张或引起好奇的开头抓住注意力。
2. 【价值】：清晰阐述产品核心卖点和价值。
3. 【比价】：通过对比凸显价格优势。
4. 【保障】：强调售后或品质保障，消除顾虑。
5. 【稀缺】：制造紧迫感，催促下单。`
};

const App = () => {
  // 默认示例文本
  const defaultText = ``;

  const [text, setText] = useState(defaultText);
  const [isPrompterOpen, setIsPrompterOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(3);
  const [fontSize, setFontSize] = useState(48);
  const [mirrorMode, setMirrorMode] = useState(false);

  // 朗读状态 (浏览器原生)
  const [isReading, setIsReading] = useState(false);
  // 浏览器语音列表
  const [systemVoices, setSystemVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [ttsRate, setTtsRate] = useState(1);
  const [ttsPitch, setTtsPitch] = useState(1);

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // 模式选择: sales (卖货), course (卖课)
  const [aiMode, setAiMode] = useState('sales');

  // 自定义违禁词状态
  const [customBannedWords, setCustomBannedWords] = useState(localStorage.getItem('custom_banned_words') || '');
  const [showBannedSettings, setShowBannedSettings] = useState(false);
  const [showBannedPanel, setShowBannedPanel] = useState(false); // 违禁词侧边面板状态

  // 自定义改写逻辑状态
  const [rewriteRules, setRewriteRules] = useState(() => {
    const saved = localStorage.getItem('rewrite_rules');
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...DEFAULT_REWRITE_RULES, ...parsed };
  });
  const [showRewriteSettings, setShowRewriteSettings] = useState(false);
  const [editingConfigMode, setEditingConfigMode] = useState('sales'); // 控制弹窗当前编辑的是哪个逻辑
  const [showLogicMenu, setShowLogicMenu] = useState(false); // 控制改写二级菜单显示
  // 【修改】短视频公式选择状态（替代原来的三个字段）
  const [shortVideoFormula, setShortVideoFormula] = useState(() => {
    const saved = localStorage.getItem('short_video_formula');
    return saved || 'formula_1'; // 默认选中第一个公式
  });

  // TTS 配置状态 (新增)
  const [ttsConfig, setTtsConfig] = useState(() => {
    const saved = localStorage.getItem('tts_config');
    return saved ? JSON.parse(saved) : {
      provider: 'browser', // browser, aliyun, volcengine, azure
      aliyun: { appKey: '', accessKeyId: '', accessKeySecret: '' },
      volcengine: { appId: '', accessToken: '' },
      azure: { key: '', region: '' }
    };
  });

  // 话题输入弹窗状态
  const [topicModal, setTopicModal] = useState({ isOpen: false, mode: 'sales' });
  const [topicInput, setTopicInput] = useState('');

  // 暗门逻辑
  const [secretCount, setSecretCount] = useState(0);
  const secretTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 状态管理
  const [showSettings, setShowSettings] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [ttsError, setTtsError] = useState('');
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);
  const [isExportingKling, setIsExportingKling] = useState(false);

  // 【新增】Seedance 提示词相关状态
  const [seedancePrompt, setSeedancePrompt] = useState('');
  const [showSeedanceModal, setShowSeedanceModal] = useState(false);
  const [seedanceInput, setSeedanceInput] = useState('');
  const [showExportMoreMenu, setShowExportMoreMenu] = useState(false);

  // 【新增】爆款标题相关状态
  const [showViralTitleModal, setShowViralTitleModal] = useState(false);
  const [viralTitleInput, setViralTitleInput] = useState('');
  const [viralTitleResult, setViralTitleResult] = useState('');

  // 【新增】爆款封面提示词相关状态
  const [showCoverPromptModal, setShowCoverPromptModal] = useState(false);
  const [coverPromptInput, setCoverPromptInput] = useState('');
  const [coverPromptResult, setCoverPromptResult] = useState('');

  // 【新增】课程名/产品名状态
  const [courseTitle, setCourseTitle] = useState('');
  const [productTitle, setProductTitle] = useState('');

  // Redux state
  const dispatch = useDispatch();
  const subscription = useSelector((state: any) => state.subscription);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // 弹窗状态管理
  const [modalConfig, setModalConfig] = useState({
    isOpen: false,
    type: 'alert',
    content: '',
    onConfirm: null
  });

  // AI 配置状态 - API Key 从环境变量读取
  const [aiConfig] = useState({
    provider: 'deepseek',
    apiKey: import.meta.env.VITE_DEEPSEEK_API_KEY || '',
    baseUrl: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat'
  });

  const TTS_PROVIDERS = {
    browser: { name: '浏览器原生 (免费)', desc: '无需配置' },
    aliyun: { name: '阿里云 (Aliyun)', desc: '自然度高' },
    volcengine: { name: '火山引擎 (Volcengine)', desc: '拟真度极高' },
    azure: { name: '微软 Azure', desc: '多语言强' }
  };

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 初始化 Redux 订阅状态
  useEffect(() => {
    // 从 localStorage 读取试用开始时间
    let trialStart = localStorage.getItem('trial_start');
    if (!trialStart) {
      trialStart = Date.now().toString();
      localStorage.setItem('trial_start', trialStart);
    }

    // 读取每日使用记录
    const today = new Date().toDateString();
    let dailyUsage = JSON.parse(localStorage.getItem('daily_usage') || '{}');

    // 验证数据格式
    if (typeof dailyUsage !== 'object' || dailyUsage === null) {
      dailyUsage = {};
    }

    // 验证并重置日期
    if (!dailyUsage.date || dailyUsage.date !== today) {
      dailyUsage.date = today;
      dailyUsage.creditsUsed = 0;
    }

    // 验证并修正 creditsUsed
    if (typeof dailyUsage.creditsUsed !== 'number' || dailyUsage.creditsUsed < 0) {
      dailyUsage.creditsUsed = 0;
    }
    if (dailyUsage.creditsUsed > 10) {
      dailyUsage.creditsUsed = 10;
    }

    // 写回 localStorage
    localStorage.setItem('daily_usage', JSON.stringify(dailyUsage));

    // 计算试用结束时间 (3天后)
    const trialEndDate = new Date(parseInt(trialStart) + 3 * 24 * 60 * 60 * 1000);

    // 读取订阅状态
    const savedSubscription = JSON.parse(localStorage.getItem('subscription') || '{}');

    // 初始化 Redux state
    dispatch(setSubscriptionStatus({
      isPro: savedSubscription.isPro || false,
      planType: savedSubscription.planType || null,
      subscriptionEnd: savedSubscription.subscriptionEnd || null,
      trialEnd: trialEndDate.toISOString(),
      dailyCreditsUsed: dailyUsage.creditsUsed,
      dailyCreditsLimit: 10
    }));

    // 【临时调试】添加调试日志
    console.log('🔍 初始化调试:', {
      dailyUsage,
      dailyCreditsUsed: dailyUsage.creditsUsed,
      dailyCreditsLimit: 10,
      remainingCredits: 10 - dailyUsage.creditsUsed
    });
  }, [dispatch]);

  // --- 初始化 Paddle.js ---
  useEffect(() => {
    const clientToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
    const environment = import.meta.env.VITE_PADDLE_ENVIRONMENT || 'sandbox';

    if (!clientToken) {
      console.error(
        '❌ Paddle 初始化失败：缺少 VITE_PADDLE_CLIENT_TOKEN 环境变量。\n' +
        '请在 .env 文件中设置：VITE_PADDLE_CLIENT_TOKEN=your_client_token'
      );
      return;
    }

    console.log('🔄 正在初始化 Paddle...', { environment, hasToken: !!clientToken });

    initializePaddle({
      token: clientToken,
      environment: environment === 'sandbox' ? 'sandbox' : 'production',
      eventCallback: (event) => {
        console.log('Paddle Event:', event.name, event.data);

        if (event.name === 'checkout.completed') {
          const savedSubscription = JSON.parse(localStorage.getItem('subscription') || '{}');
          dispatch(setSubscriptionStatus({
            isPro: savedSubscription.isPro || true,
            planType: savedSubscription.planType || 'monthly',
            subscriptionEnd: savedSubscription.subscriptionEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            trialEnd: new Date(parseInt(localStorage.getItem('trial_start') || Date.now().toString()) + 3 * 24 * 60 * 60 * 1000).toISOString(),
            dailyCreditsUsed: JSON.parse(localStorage.getItem('daily_usage') || '{}').creditsUsed || 0,
            dailyCreditsLimit: Infinity
          }));
        }

        if (event.name === 'checkout.closed') {
          console.log('Checkout closed without payment');
        }
      }
    }).then(() => {
      console.log('✅ Paddle 初始化成功');
    }).catch(error => {
      console.error('❌ Paddle 初始化失败:', error);
    });
  }, []);

  // 监听自定义词库变化并保存
  useEffect(() => {
    localStorage.setItem('custom_banned_words', customBannedWords);
  }, [customBannedWords]);

  // 监听改写规则变化并保存
  useEffect(() => {
    localStorage.setItem('rewrite_rules', JSON.stringify(rewriteRules));
  }, [rewriteRules]);

  // 监听TTS配置变化并保存
  useEffect(() => {
    localStorage.setItem('tts_config', JSON.stringify(ttsConfig));
  }, [ttsConfig]);

  useEffect(() => {
    // 加载浏览器语音
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setSystemVoices(voices);
      if (!selectedVoiceURI && voices.length > 0) {
        const cnVoice = voices.find(v => v.lang.includes('zh') && v.name.includes('Microsoft')) ||
          voices.find(v => v.lang.includes('zh-CN')) ||
          voices.find(v => v.lang.includes('zh'));
        if (cnVoice) {
          setSelectedVoiceURI(cnVoice.voiceURI);
        } else {
          setSelectedVoiceURI(voices[0]?.voiceURI);
        }
      }
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceURI]);

  // --- Paddle 订阅处理 ---
  const handleSubscribe = async (planType) => {
    try {
      // 检查 Paddle 是否已初始化
      if (!(window as any).Paddle) {
        showMessage('支付系统未初始化，请刷新页面后重试');
        console.error('❌ Paddle 未初始化：window.Paddle 不存在');
        return;
      }

      setIsAiLoading(true);
      setAiStatus('正在创建订单...');

      // 1. 调用后端获取 priceId 和 customerId
      const response = await fetch('/api/paddle/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType })
      });

      // 检查 HTTP 状态
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = '服务器错误';
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorMessage;
        } catch {
          errorMessage = errorText || `HTTP ${response.status}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.priceId) {
        throw new Error('服务器返回数据缺少 priceId');
      }

      console.log('✅ 获取到价格信息:', { priceId: data.priceId, customerId: data.customerId });

      // 2. 用 Paddle.js 打开支付页面
      (window as any).Paddle.Checkout.open({
        items: [{
          priceId: data.priceId,
          quantity: 1
        }],
        customer: {
          email: data.customerEmail,
          address: {
            countryCode: 'CN',
            postalCode: '100000'
          }
        },
        settings: {
          displayMode: 'overlay',
          theme: 'light',
          successUrl: window.location.href
        }
      });

    } catch (error) {
      console.error('❌ 创建 checkout 失败:', error);
      showMessage(`支付失败：${(error as Error).message || '请稍后重试'}`);
    } finally {
      setIsAiLoading(false);
      setAiStatus('');
    }
  };

  // --- 权限检查逻辑 ---
  const checkPermission = () => {
    if (subscription.isPro) return true;
    if (subscription.trialEnd && new Date(subscription.trialEnd) > new Date() && subscription.dailyCreditsUsed < subscription.dailyCreditsLimit) return true;
    setShowUpgradeModal(true);
    return false;
  };

  // --- 消耗积分 ---
  const consumeCredit = () => {
    if (!subscription.isPro && subscription.dailyCreditsUsed < subscription.dailyCreditsLimit) {
      // 先从 localStorage 读取当前的 creditsUsed 值
      const dailyUsage = JSON.parse(localStorage.getItem('daily_usage') || '{}');
      // 递增这个值（+1）
      const newCreditsUsed = (dailyUsage.creditsUsed || 0) + 1;
      dailyUsage.creditsUsed = newCreditsUsed;
      // 写入 localStorage
      localStorage.setItem('daily_usage', JSON.stringify(dailyUsage));
      // 再调用 dispatch(incrementCreditsUsed()) 更新 Redux
      dispatch(incrementCreditsUsed());
    }
  };

  const showMessage = (content) => {
    setModalConfig({ isOpen: true, type: 'alert', content, onConfirm: null });
  };

  const showConfirm = (content, onConfirm) => {
    setModalConfig({ isOpen: true, type: 'confirm', content, onConfirm });
  };

  const closeModal = () => {
    setModalConfig(prev => ({ ...prev, isOpen: false }));
  };

  // --- 生成话术逻辑 (本地模板+用户输入) ---
  
  // 【新增】根据短视频公式生成对应的说明文字
  const getShortVideoFormulaTemplate = (formula) => {
    const templates = {
      'formula_1': '【痛点提问型】请写出你的产品要解决的核心痛点、目标人群和使用场景。例如：目标人群是上班族宝妈，痛点是每天不知道给孩子做什么早餐。',
      'formula_2': '【反差对比型】请描述"使用前"和"使用后"的明显差异，突出产品价值。例如：使用前每天花1小时做饭，使用后只需10分钟。',
      'formula_3': '【故事悬念型】请描述一个简短有趣的故事开头，制造悬念吸引注意力。例如：曾经有一位客户...后来他发现了...',
      'formula_4': '【清单干货型】请列出"3个方法""5个技巧"等实用技巧标题。例如：3个快速减脂小技巧、5个提升工作效率的方法。',
      'formula_5': '【权威背书型】请引用专家观点、用户好评或权威认证来增强可信度。例如：XX专家推荐、10万+用户好评、XX认证机构认证。',
      'formula_6': '【反套路吐槽型】用吐槽或反套路的方式揭露行业乱象或产品槽点，引出你的解决方案。例如：你是不是也遇到过...真是太坑了！',
      'formula_7': '【角色扮演型】设定一个角色（如：闺蜜、老师、专家等），以角色的口吻进行推荐或分享。例如：作为你的闺蜜，我必须告诉你...',
      'formula_8': '【新闻播报型】用新闻播报的形式，严肃、专业地介绍产品或资讯。例如：据最新消息，XX产品重磅上市，引发关注。',
      'formula_9': '【FAQ 问答型】通过问答形式介绍产品，一问一答，清晰明了。例如：问：这款产品怎么用？答：只需三步...',
      'formula_10': '【对话剧情型】设置一个对话场景（如：和同事、朋友聊天），在对话中自然介绍产品。例如：哎，你最近用的那个...'
    };
    return templates[formula] || '';
  };

  // 【新增】根据短视频公式生成完整的 prompt（用于生成话术）
  const getShortVideoPrompt = (formula, userContent) => {
    const formulaNames = {
      'formula_1': '痛点提问型',
      'formula_2': '反差对比型',
      'formula_3': '故事悬念型',
      'formula_4': '清单干货型',
      'formula_5': '权威背书型',
      'formula_6': '反套路吐槽型',
      'formula_7': '角色扮演型',
      'formula_8': '新闻播报型',
      'formula_9': 'FAQ 问答型',
      'formula_10': '对话剧情型'
    };

    return `你是短视频脚本助手，请根据下面的提示词和公式，生成一段 30–45 秒的短视频口播卖货话术：

爆款公式：${formulaNames[formula] || '通用'}

用户补充说明：
${userContent || '（请补充产品信息、目标人群、核心卖点等）'}

语言要口语化、适合口播，结构清晰，有开头抓人和结尾行动号召。`;
  };

  const generateDraft = async (mode, topic) => {
    let draft = "";
    // 【修改】根据模式设置默认主题名称
    const defaultName = mode === 'sales' ? "这款产品" : mode === 'short-video' ? "这个主题" : "这门课程";
    const productName = topic || (mode === 'sales' ? productTitle : mode === 'course' ? courseTitle : defaultName) || defaultName;

    // 【修改】按模式区分卖货/卖课/短视频的分支
    if (mode === 'sales') {
      // 卖货模式：使用五步卖货逻辑（偏直播卖货话术）
      draft = `① 留人（约3秒）|
"所有人停一下！| 还在为买不到好用的${productName}发愁吗？看过来！↑" ||

② 价值（约15秒）|
"今天给大家带来的这款 *${productName}*，| 真的是我用过最好用的！| 它不仅外观时尚，| 而且功能超级强大，| 能完美解决你的痛点！*太绝了*！" ||

③ 比价（约10秒）|
"你去外面随便问，| 同样品质的${productName}，| 起码要卖到 *X99* 元！| 但是今天在我的直播间，| 我们直接源头工厂价，| 价格打到骨折！" ||

④ 保障（约10秒）|
"我们承诺 *七天无理由退换*，| 还有运费险，| 让你买得放心，| 用得安心！| 不满意包退！" ||

⑤ 稀缺（约5秒）|
"不过因为太火爆了，| 厂家只给了我们 50 单库存，| *手慢无*！| 抢到就是赚到！| 3，2，1，上链接！↓"`;
    } else if (mode === 'short-video') {
      // 【修改】短视频模式：使用 AI 生成，根据公式 + 用户补充说明
      const userContent = rewriteRules['short-video'] || '';
      const prompt = getShortVideoPrompt(shortVideoFormula, userContent);
      
      // 调用 AI 生成
      setIsAiLoading(true);
      setAiStatus('AI 正在生成短视频话术...');
      
      try {
        const cleanText = `产品主题：${topic || '未指定'}\n\n${userContent}`;
        
        const response = await fetch(aiConfig.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${aiConfig.apiKey}`
          },
          body: JSON.stringify({
            model: aiConfig.model,
            messages: [
              { role: "system", content: prompt },
              { role: "user", content: cleanText }
            ],
            temperature: 0.7
          })
        });
        
        const data = await response.json();
        
        if (data.error) {
          throw new Error(data.error.message || 'API 调用失败');
        }
        
        const aiText = data.choices?.[0]?.message?.content;
        
        if (aiText) {
          setText(aiText.trim());
          setAiStatus('短视频话术生成完成！');
          consumeCredit();
        } else {
          throw new Error('AI 返回内容为空');
        }
       } catch (error) {
         console.error('生成短视频话术失败:', error);
         showMessage('生成失败，请稍后重试。');
       } finally {
         setIsAiLoading(false);
       }
      return; // 【修改】短视频模式使用 AI 生成，不继续执行下面的代码
    } else {
      // 卖课模式：使用单独的卖课逻辑，避免出现面膜/价格战等纯卖货内容
      draft = `① 放钩子（约5秒）|
"想学${productName}的同学先别划走！| 只需要 3 天，| 带你从小白变大神！↑" ||

② 讲痛点（约15秒）|
"很多同学是不是觉得${productName}太难了？| 或者是学了很久不开窍？| 一看书就困？| 甚至想放弃？||"

③ 讲人设（约10秒）|
"别担心，| 我是深耕行业 10 年的 *XX老师*。| 我带过上万名学员，| 把最复杂的知识都总结成了口诀，| 像搭积木一样简单。" ||

④ 讲试题/干货（约20秒）|
"来，看这个核心知识点：| （这里插入${productName}的一个简单技巧或例题）。| 其实非常简单，| 只要掌握了这个逻辑，| 你也能轻松学会。||"

⑤ 讲进群（约10秒）|
"如果你想系统学习，| 现在点击下方链接或者打'进群'，| 我会把这套【${productName}思维导图】发在群里。||"

⑥ 发福袋（约10秒）|
"今天进群的同学，| 老师再额外送你一套价值 199 元的实战资料包！| 名额有限，| 抓紧时间上车！↓"`;
    }
    setText(draft);
    setTopicModal({ isOpen: false, mode: 'sales' });
    setTopicInput('');
  };

  // 处理模式点击：映射到自定义逻辑
  const handleModeClick = (mode) => {
    playClickSound();
    setAiMode(mode);
    // 【修改】不打开话题输入弹窗，而是打开对应的自定义逻辑设置弹窗
    openRewriteSettings(mode);
  };

  // --- 改写规则逻辑 ---
  const handleResetRewriteRules = () => {
    playClickSound();
    showConfirm('确定要重置该模式的改写规则为默认值吗？', () => {
      setRewriteRules(prev => ({ ...prev, [editingConfigMode]: DEFAULT_REWRITE_RULES[editingConfigMode] }));
    });
  };

  const openRewriteSettings = (mode) => {
    playClickSound();
    setEditingConfigMode(mode);
    setShowRewriteSettings(true);
    setShowLogicMenu(false);
  };

  // --- 违禁词面板开关 ---
  const handleBannedPanelToggle = () => {
    playClickSound();
    setShowBannedPanel(prev => !prev); // 展开/收起违禁词侧边面板
  };

  // --- 朗读核心逻辑 ---
  const handleSpeakToggle = () => {
    playClickSound();
    setTtsError('');

    if (isReading) {
      window.speechSynthesis.cancel();
      setIsReading(false);
      return;
    }

    if (!text) return;

    // 清理文本逻辑
    const cleanTextForSpeech = text
      .replace(/\|\|/g, '。')
      .replace(/\|/g, '，')
      .replace(/\*/g, '')
      .replace(/↑/g, '')
      .replace(/↓/g, '')
      .replace(/【/g, '')
      .replace(/】/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanTextForSpeech);
    utteranceRef.current = utterance;

    const voice = systemVoices.find(v => v.voiceURI === selectedVoiceURI);
    if (voice) utterance.voice = voice;

    utterance.rate = ttsRate;
    utterance.pitch = ttsPitch;

    utterance.onstart = () => {
      setIsReading(true);
    };

    utterance.onend = () => {
      setIsReading(false);
      utteranceRef.current = null;
    };

    utterance.onerror = (e) => {
      const errorName = (e.error as any)?.toString?.() || e.error;
      if (errorName === 'canceled' || errorName === 'interrupted') {
        setIsReading(false);
        return;
      }
      console.error("TTS Real Error:", e.error);
      setIsReading(false);
      setTtsError('朗读出错: ' + e.error);
      if (errorName !== 'canceled' && errorName !== 'interrupted') {
        setShowVoiceSettings(true);
      }
    };

    window.speechSynthesis.cancel();
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  const handleSecretClick = () => {
    playClickSound();
    setSecretCount(prev => {
      const newCount = prev + 1;
      if (newCount >= 8) {
        setShowSettings(true);
        return 0;
      }
      return newCount;
    });
    if (secretTimeoutRef.current) clearTimeout(secretTimeoutRef.current);
    secretTimeoutRef.current = setTimeout(() => setSecretCount(0), 2000);
  };

  const saveTtsConfig = (newConfig) => {
    setTtsConfig(newConfig);
  };

  // --- 1. AI 违禁词过滤 ---
  const callContrabandCheck = async () => {
    playClickSound();

    if (!aiConfig.apiKey) {
      showMessage('未检测到 API Key，请在 .env 文件中配置 VITE_DEEPSEEK_API_KEY。');
      return;
    }

    setIsAiLoading(true);
    setAiStatus('AI 正在扫描违禁词...');

    const systemPrompt = `你是一位专业的内容风控专家，熟悉广告法和平台审核规则。
任务：请检查用户的文稿，识别其中的"违禁词"、"极限词"（如：第一、最强、顶级、独家、包治百病、秒杀全网等）。
处理方式：
1. 保持原文内容不变。
2. 将识别出的违禁词用【】包裹。
3. 在【】后面紧跟圆括号 (建议改为：xxx) 提供合规修改建议。
4. 如果没有违禁词，请直接返回原文，不要有多余解释。`;

    const cleanText = text.replace(/\|/g, '').replace(/\*/g, '').replace(/↑/g, '').replace(/↓/g, '').replace(/【|】/g, '');

    try {
      const response = await fetch(aiConfig.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.apiKey}` },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: cleanText }],
          temperature: 0.1
        })
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'API 调用失败');
      }

      const aiText = data.choices?.[0]?.message?.content;

      if (aiText) {
        // --- 核心更新：在 AI 结果基础上，叠加用户自定义违禁词 ---
        let processedText = aiText.trim();

        if (customBannedWords) {
          const words = customBannedWords.split(/[,，\n\s]+/).filter(w => w.trim());
          words.forEach(word => {
            const safeWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(safeWord, 'g');
            processedText = processedText.replace(regex, `【${word}】`);
          });
          // 清理可能产生的双重括号
          processedText = processedText.replace(/【+([^】]+)】+/g, '【$1】');
        }

        setText(processedText);
        setAiStatus('扫描完成！');

        consumeCredit();

        await new Promise(r => setTimeout(r, 500));
      } else {
        throw new Error('API 返回内容为空');
      }
    } catch (error) {
      const err = error as Error;
      showMessage(`请求失败: ${err.message}\n\n请检查 API Key 是否有效。`);
    } finally {
      setIsAiLoading(false);
      setAiStatus('');
    }
  };

  // --- 2. AI 改写 ---
  const callRewrite = async () => {
    playClickSound();

    // 去掉权限校验，直接执行
    // if (!checkPermission()) return;

    if (!aiConfig.apiKey) {
      showMessage('未检测到 API Key，请联系管理员或在设置中配置自定义 Key。');
      return;
    }

    setIsAiLoading(true);
    setAiStatus('AI 正在改写文案...');

    // 使用当前模式的自定义规则
    const currentRule = rewriteRules[aiMode];

    let systemPrompt = "";
    if (aiMode === 'sales') {
      systemPrompt = `你是一位金牌带货主播文案专家。
请将用户的文稿改写为【卖货型】口播文案，严格遵循以下逻辑结构：
${currentRule}
产品名称：${productTitle || '（未填写）'}

要求：口语化，情绪饱满，节奏紧凑。保持原意，但结构要符合上述逻辑。`;
    } else if (aiMode === 'short-video') {
      // 【修改】根据短视频公式 ID 添加不同的 prompt 说明
      let formulaPrompt = '';
      switch (shortVideoFormula) {
        case 'formula_1':
          formulaPrompt = '你是短视频脚本助手，请用【痛点提问型】公式写一条30–45秒口播稿。开头直接戳中用户痛点，中间给出解决方案，结尾引导行动。语言要口语化，适合任何行业的短视频讲解或卖点呈现。';
          break;
        case 'formula_2':
          formulaPrompt = '你是短视频脚本助手，请用【反差对比型】公式写一条30–45秒口播稿。前后对比展示"使用前"和"使用后"的明显差异，突出产品价值。语言要口语化，适合任何行业的短视频讲解或卖点呈现。';
          break;
        case 'formula_3':
          formulaPrompt = '你是短视频脚本助手，请用【故事悬念型】公式写一条30–45秒口播稿。用一个简短有趣的故事开头，制造悬念吸引注意力，最后引出产品。语言要口语化，适合任何行业的短视频讲解或卖点呈现。';
          break;
        case 'formula_4':
          formulaPrompt = '你是短视频脚本助手，请用【清单干货型】公式写一条30–45秒口播稿。以"3个方法""5个技巧"等形式分享实用技巧，快速传递价值。语言要口语化，适合任何行业的短视频讲解或卖点呈现。';
          break;
        case 'formula_5':
          formulaPrompt = '你是短视频脚本助手，请用【权威背书型】公式写一条30–45秒口播稿。引用专家观点、用户好评或权威认证来增强可信度。语言要口语化，适合任何行业的短视频讲解或卖点呈现。';
          break;
        // 新增 5 个爆款公式的 prompt
        case 'formula_6':
          formulaPrompt = '你是短视频脚本助手，请用【反套路吐槽型】公式写一条30–45秒口播稿。用吐槽或反套路的方式揭露行业乱象或产品槽点，然后引出你的解决方案。语言要口语化、幽默风趣，适合任何行业的短视频讲解或卖点呈现。';
          break;
        case 'formula_7':
          formulaPrompt = '你是短视频脚本助手，请用【角色扮演型】公式写一条30–45秒口播稿。设定一个角色（如闺蜜、老师、专家等），以角色的口吻进行推荐或分享。语言要口语化、符合角色设定，适合任何行业的短视频讲解或卖点呈现。';
          break;
        case 'formula_8':
          formulaPrompt = '你是短视频脚本助手，请用【新闻播报型】公式写一条30–45秒口播稿。用新闻播报的形式，严肃、专业地介绍产品或资讯。语言要正式、客观，适合任何行业的短视频讲解或卖点呈现。';
          break;
        case 'formula_9':
          formulaPrompt = '你是短视频脚本助手，请用【FAQ 问答型】公式写一条30–45秒口播稿。通过问答形式介绍产品，一问一答，清晰明了地展示产品特点和优势。语言要口语化，适合任何行业的短视频讲解或卖点呈现。';
          break;
        case 'formula_10':
          formulaPrompt = '你是短视频脚本助手，请用【对话剧情型】公式写一条30–45秒口播稿。设置一个对话场景（如和同事、朋友聊天），在对话中自然介绍产品。语言要口语化、自然流畅，适合任何行业的短视频讲解或卖点呈现。';
          break;
        default:
          formulaPrompt = '你是短视频脚本助手，请写一条30–45秒口播稿。语言要口语化，适合任何行业的短视频讲解或卖点呈现。';
      }
      systemPrompt = `你是一位短视频爆款文案专家。
请将用户的文稿改写为【短视频型】口播文案，严格遵循以下逻辑结构：
${currentRule}

要求：节奏快、冲击力强。保持原意，但结构要符合上述逻辑。`;
      systemPrompt = formulaPrompt + '\n\n' + systemPrompt;
    } else {
      // course mode
      systemPrompt = `你是一位知识付费领域的金牌销售文案专家。
请将用户的文稿改写为【卖课型】口播文案，严格遵循以下逻辑结构：
${currentRule}
课程名称：${courseTitle || '（未填写）'}

要求：循循善诱，逻辑严密，极具煽动性。保持原意，但结构要符合上述逻辑。`;
    }

    const cleanText = text.replace(/\|/g, '').replace(/\*/g, '').replace(/↑/g, '').replace(/↓/g, '').replace(/【|】/g, '');

    try {
      const response = await fetch(aiConfig.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.apiKey}` },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: cleanText }],
          temperature: 0.7
        })
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'API 调用失败');
      }

      const aiText = data.choices?.[0]?.message?.content;

      if (aiText) {
        setText(aiText.trim());
        setAiStatus('改写完成！');

        consumeCredit();

        await new Promise(r => setTimeout(r, 500));
      } else {
        throw new Error('API 返回内容为空');
      }
    } catch (error) {
      const err = error as Error;
      showMessage(`请求失败: ${err.message}\n\n请检查 API Key 是否有效。`);
    } finally {
      setIsAiLoading(false);
      setAiStatus('');
    }
  };

  // --- 3. AI 播感标注 ---
  const callProsodyAnnotation = async () => {
    playClickSound();

    // 去掉权限校验，直接执行
    // if (!checkPermission()) return;

    if (!aiConfig.apiKey) {
      showMessage('未检测到 API Key，请联系管理员或在设置中配置自定义 Key。');
      return;
    }

    setIsAiLoading(true);
    setAiStatus('AI 正在添加播感标注...');

    let rolePrompt = "";
    if (aiMode === 'sales') {
      rolePrompt = `你是一位金牌带货主播，风格激情、紧凑、强调重音。`;
    } else {
      rolePrompt = `你是一位知识科普博主，风格沉稳、逻辑清晰、强调关键概念。`;
    }

    const systemPrompt = `
${rolePrompt}
任务：请对用户的文稿进行【播感标注】，**严禁修改原文案内容**，只允许添加符号。
请在文本中插入以下符号：
   - '|'  ：短停顿/气口 (用于短句之间)
   - '||' ：长停顿/换气 (用于句号或段落间)
   - '*词语*'：重音/强调 (用 * 包裹重点词)
   - '↑'  ：语调上扬 (用于疑问、反问或引起注意的结尾)
   - '↓'  ：语调下沉 (用于肯定、确信或结束的结尾)`;

    const cleanText = text.replace(/\|/g, '').replace(/\*/g, '').replace(/↑/g, '').replace(/↓/g, '');

    try {
      const response = await fetch(aiConfig.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.apiKey}` },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: cleanText }],
          temperature: 0.7
        })
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'API 调用失败');
      }

      const aiText = data.choices?.[0]?.message?.content;

      if (aiText) {
        setText(aiText.trim());
        setAiStatus('标注完成！');

        consumeCredit();

        await new Promise(r => setTimeout(r, 500));
      } else {
        throw new Error('API 返回内容为空');
      }
    } catch (error) {
      const err = error as Error;
      showMessage(`请求失败: ${err.message}\n\n请检查 API Key 是否有效。`);
    } finally {
      setIsAiLoading(false);
      setAiStatus('');
    }
  };

  // 【新增】Seedance 提示词生成
  const generateSeedancePrompt = async () => {
    playClickSound();

    if (!aiConfig.apiKey) {
      showMessage('未检测到 API Key，请联系管理员或在设置中配置自定义 Key。');
      return;
    }

    if (!seedanceInput || seedanceInput.trim().length === 0) {
      showMessage('请输入场景描述。');
      return;
    }

    setIsAiLoading(true);
    setAiStatus('AI 正在生成 Seedance 提示词...');

    const systemPrompt = `你是一位专业的视频提示词专家，擅长将中文场景描述转换为 Seedance 风格的英文提示词。
任务：将用户的中文场景描述转换为一组 Seedance 风格的英文提示词。
要求：
1. 输出必须包含主体（人物/物体）、场景环境、动作、镜头运动、光线、氛围等元素。
2. 使用专业的电影摄影术语，如 close-up（特写）、medium shot（中景）、wide angle（广角）、tracking shot（跟拍）等。
3. 包含光影描述，如 cinematic lighting（电影感光照）、dramatic shadows（戏剧性阴影）、golden hour（黄金时刻）等。
4. 包含风格描述，如 cinematic（电影感）、photorealistic（照片级真实）、dramatic（戏剧性）等。
5. 纯英文输出，不要包含中文。
6. 多个提示词用换行分隔，每个提示词独立成行。`;

    try {
      const response = await fetch(aiConfig.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.apiKey}` },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: seedanceInput }],
          temperature: 0.8
        })
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'API 调用失败');
      }

      const aiText = data.choices?.[0]?.message?.content;

      if (aiText) {
        setSeedancePrompt(aiText.trim());
        setAiStatus('提示词生成完成！');

        consumeCredit();

        await new Promise(r => setTimeout(r, 500));
      } else {
        throw new Error('AI 返回内容为空');
      }
    } catch (error) {
      const err = error as Error;
      showMessage(`请求失败: ${err.message}\n\n请检查 API Key 是否有效。`);
    } finally {
      setIsAiLoading(false);
      setAiStatus('');
    }
  };

  // 【新增】爆款标题生成 - 调用 AI 接口
  const generateViralTitle = async () => {
    playClickSound();

    if (!aiConfig.apiKey) {
      showMessage('未检测到 API Key，请联系管理员或在设置中配置自定义 Key。');
      return;
    }

    if (!viralTitleInput || viralTitleInput.trim().length === 0) {
      showMessage('请输入主题描述。');
      return;
    }

    setIsAiLoading(true);
    setAiStatus('AI 正在生成爆款标题...');

    const systemPrompt = `你是爆款标题专家，请根据下面的主题，生成 8 条适合短视频/小红书的吸睛标题，要求：简短有力、带钩子、引发好奇或共鸣。
主题：${viralTitleInput}`;

    try {
      const response = await fetch(aiConfig.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.apiKey}` },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: viralTitleInput }],
          temperature: 0.8
        })
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'API 调用失败');
      }

      const aiText = data.choices?.[0]?.message?.content;

      if (aiText) {
        setViralTitleResult(aiText.trim());
        setAiStatus('标题生成完成！');

        consumeCredit();

        await new Promise(r => setTimeout(r, 500));
      } else {
        throw new Error('AI 返回内容为空');
      }
    } catch (error) {
      const err = error as Error;
      showMessage(`请求失败: ${err.message}\n\n请检查 API Key 是否有效。`);
    } finally {
      setIsAiLoading(false);
      setAiStatus('');
    }
  };

  // 【新增】爆款封面提示词生成 - 调用 AI 接口
  const generateCoverPrompt = async () => {
    playClickSound();

    if (!aiConfig.apiKey) {
      showMessage('未检测到 API Key，请联系管理员或在设置中配置自定义 Key。');
      return;
    }

    if (!coverPromptInput || coverPromptInput.trim().length === 0) {
      showMessage('请输入画面描述。');
      return;
    }

    setIsAiLoading(true);
    setAiStatus('AI 正在生成封面提示词...');

    const systemPrompt = `你是封面设计专家，请根据下面的描述，生成一段 40–60 个英文单词的图片生成提示词，专门适合 Nano Banana 使用，要求：画面清晰、视觉冲击强、适合短视频封面，语言简洁、符合 Nano Banana 的提示词风格。
描述：${coverPromptInput}`;

    try {
      const response = await fetch(aiConfig.baseUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${aiConfig.apiKey}` },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: "system", content: systemPrompt }, { role: "user", content: coverPromptInput }],
          temperature: 0.8
        })
      });
      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message || 'API 调用失败');
      }

      const aiText = data.choices?.[0]?.message?.content;

      if (aiText) {
        setCoverPromptResult(aiText.trim());
        setAiStatus('提示词生成完成！');

        consumeCredit();

        await new Promise(r => setTimeout(r, 500));
      } else {
        throw new Error('AI 返回内容为空');
      }
    } catch (error) {
      const err = error as Error;
      showMessage(`请求失败: ${err.message}\n\n请检查 API Key 是否有效。`);
    } finally {
      setIsAiLoading(false);
      setAiStatus('');
    }
  };

  const clearMarks = () => {
    playClickSound();
    showConfirm('要清空所有标记和违禁词提示嘛？', () => {
      setText(text.replace(/[|*↑↓【】]/g, '').replace(/\(建议改为：.*?\)/g, ''));
    });
  };

  // 将编辑区文本序列化为适合 Word 的纯文本格式
  const serializeForWord = (editorText) => {
    if (!editorText) return '';

    let docText = editorText;

    // 处理短停顿 | -> [短停]
    docText = docText.replace(/\|/g, ' [短停] ');

    // 处理长停顿 || -> [长停]
    docText = docText.replace(/\|\|/g, '\n[长停]\n');

    // 处理重音 *词语* -> [词语]
    docText = docText.replace(/\*([^*]+)\*/g, '[$1]');

    // 处理语调上扬 ↑ -> [上扬]
    docText = docText.replace(/↑/g, ' [上扬]');

    // 处理语调下沉 ↓ -> [收尾]
    docText = docText.replace(/↓/g, ' [收尾]');

    // 移除违禁词标记及其建议
    docText = docText.replace(/【([^】]+)】/g, '$1');
    docText = docText.replace(/\(建议改为：.*?\)/g, '');

    // 清理多余空格和换行
    docText = docText.replace(/\n{3,}/g, '\n\n');
    docText = docText.replace(/[ \t]+/g, ' ');

    return docText.trim();
  };

  // 导出 Word 文档
  // 【恢复】这里是找回的原导出逻辑
  const handleExportWord = async () => {
    playClickSound();

    // 检查内容是否为空
    if (!text || text.trim().length === 0) {
      showMessage('没有内容可以导出，请先输入或生成文案。');
      return;
    }

    setIsExportingWord(true);

    try {
      // 序列化文本为 Word 友好格式
      const docText = serializeForWord(text);

      // 生成文件名：智能口播提词稿_2026-02-04.docx
      const date = new Date();
      const dateStr = date.toISOString().split('T')[0];
      const fileName = `智能口播提词稿_${dateStr}.docx`;

      // 调用后端接口
      const response = await fetch('/api/export-word', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: docText,
          title: '智能口播提词稿'
        }),
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      // 接收二进制文件流并触发下载
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showMessage('导出成功！文件已下载。');
    } catch (error) {
      console.error('导出 Word 失败:', error);
      showMessage('导出失败，请稍后重试。');
    } finally {
      setIsExportingWord(false);
    }
  };

  // 【恢复】这里是找回的原导出逻辑
  // 导出 SRT 字幕文件（原导出 JSON 改为导出 SRT）
  const handleExportJson = async () => {
    playClickSound();

    // 检查内容是否为空
    if (!text || text.trim().length === 0) {
      showMessage('没有内容可以导出，请先输入或生成文案。');
      return;
    }

    setIsExportingJson(true);

    try {
      // 直接发送原始文本（不经过 serializeForWord），让后端处理
      console.log('[导出 SRT] 发送文本长度:', text.length);
      console.log('[导出 SRT] 文本预览:', text.substring(0, 200));

      // 调用后端接口获取字幕数据
      const response = await fetch('/api/export-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: text, // 直接发送原始文本
          title: '智能口播提词稿'
        }),
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      // 接收 JSON 数据并转换为 SRT
      const jsonData = await response.json();
      console.log('[导出 SRT] 后端返回:', {
        segmentCount: jsonData?.segments?.length,
        totalDuration: jsonData?.metadata?.total_duration_hint
      });

      // 【新增】调用 json → srt 转换函数
      const srtContent = toSrt(jsonData?.segments || []);
      console.log('[导出 SRT] SRT 内容长度:', srtContent.length);

      // 【修改】创建 SRT Blob 并触发下载
      const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);

      // 生成文件名（包含时间戳，避免缓存）
      const date = new Date();
      const timestamp = date.toISOString().replace(/[:.]/g, '-');
      const safeTitle = (jsonData.title || '智能口播提词稿').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_');
      const fileName = `${safeTitle}_${timestamp}.srt`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showMessage('导出成功！SRT 字幕文件已下载。');
    } catch (error) {
      console.error('导出 SRT 失败:', error);
      showMessage('导出失败，请稍后重试。');
    } finally {
      setIsExportingJson(false);
    }
  };

  // 【恢复】这里是找回的原导出逻辑
  // 【新增】json → srt 转换函数
  const formatSrtTime = (seconds) => {
    const ms = Math.floor(seconds * 1000);
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const msRest = ms % 1000;
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(msRest, 3)}`;
  };

  const toSrt = (subtitles) => {
    return subtitles.map((item, idx) => {
      const start = formatSrtTime(item.start || item.startTime);
      const end = formatSrtTime(item.end || item.endTime);
      const text = item.text || item.content || '';
      return `${idx + 1}\n${start} --> ${end}\n${text}\n`;
    }).join('\n');
  };

  const handleExportKling = async () => {
    playClickSound();

    if (!text || text.trim().length === 0) {
      showMessage('没有内容可以导出，请先输入或生成文案。');
      return;
    }

    setIsExportingKling(true);

    try {
      // 调用后端接口获取字幕数据
      const response = await fetch('/api/export-json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: text,
          title: '智能口播提词稿'
        }),
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      // 接收字幕数据
      const jsonData = await response.json();
      const segments = jsonData?.segments || [];

      // 【新增】组装通用 JSON 格式，包含 seedance_prompt
      const outputData = {
        seedance_prompt: seedancePrompt || '', // 【修改】导出时将 seedance_prompt 一并写入
        segments: segments.map((item) => ({
          start: item.start || item.startTime || 0,
          end: item.end || item.endTime || 0,
          text: item.text || item.content || '',
          speaker: 'A', // 默认说话人，可根据需要扩展
          note: '' // 备注，可根据需要扩展
        }))
      };

      const jsonStr = JSON.stringify(outputData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);

      const date = new Date();
      const timestamp = date.toISOString().replace(/[:.]/g, '-');
      const safeTitle = (jsonData.title || '智能口播提词稿').replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '_');
      const fileName = `${safeTitle}_${timestamp}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showMessage('导出成功！通用 JSON 文件已下载。');
    } catch (error) {
      console.error('导出 JSON 失败:', error);
      showMessage('导出失败，请稍后重试。');
    } finally {
      setIsExportingKling(false);
    }
  };

  const insertMark = (type) => {
    playClickSound();
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: s, selectionEnd: e } = ta;
    const txt = text;
    let nTxt = '', nP = e;

    if (type === 'stress') {
      const sel = txt.substring(s, e);
      if (sel) { nTxt = txt.substring(0, s) + (sel.startsWith('*') ? sel.slice(1, -1) : `*${sel}*`) + txt.substring(e); nP = s + (sel.startsWith('*') ? sel.length - 2 : sel.length + 2); }
      else { nTxt = txt.substring(0, s) + `**` + txt.substring(e); nP = s + 1; }
    } else if (type === 'short') { nTxt = txt.substring(0, s) + ' | ' + txt.substring(e); nP = s + 3; }
    else if (type === 'long') { nTxt = txt.substring(0, s) + ' ||\n' + txt.substring(e); nP = s + 4; }
    else if (type === 'up') { nTxt = txt.substring(0, s) + '↑' + txt.substring(e); nP = s + 1; }
    else if (type === 'down') { nTxt = txt.substring(0, s) + '↓' + txt.substring(e); nP = s + 1; }

    setText(nTxt);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(nP, nP); }, 0);
  };

  useEffect(() => {
    if (isPrompterOpen && isPlaying) {
      scrollIntervalRef.current = setInterval(() => {
        if (scrollerRef.current) {
          scrollerRef.current.scrollTop += scrollSpeed;
          if (scrollerRef.current.scrollTop + scrollerRef.current.clientHeight >= scrollerRef.current.scrollHeight - 5) setIsPlaying(false);
        }
      }, 30);
    } else if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current);
    return () => { if (scrollIntervalRef.current) clearInterval(scrollIntervalRef.current); };
  }, [isPrompterOpen, isPlaying, scrollSpeed]);

  const renderStyledText = (t) => t.split(/(\*.*?\*|\|+|↑|↓|【.*?】|\n)/g).map((p, i) => {
    if (p === '|') return <span key={i} className="mx-1 text-gray-300 font-light text-sm align-middle">|</span>;
    if (p === '||') return <span key={i} className="mx-1 text-[#EF4444] font-bold text-lg align-middle">||</span>;
    if (p === '\n') return <br key={i} />;
    if (p === '↑') return <span key={i} className="mx-0.5 text-[#EF4444] font-bold text-xl align-text-bottom" title="语调上扬">↗</span>;
    if (p === '↓') return <span key={i} className="mx-0.5 text-[#3B82F6] font-bold text-xl align-text-top" title="语调下沉">↘</span>;
    if (p.startsWith('*')) return <span key={i} className="text-[#3B82F6] font-bold bg-[#F9FAFB] px-1 rounded mx-0.5 border-b-2 border-[#BFDBFE]">{p.replace(/\*/g, '')}</span>;
    if (p.startsWith('【') && p.endsWith('】')) return <span key={i} className="text-red-500 font-black bg-[#F9FAFB] px-1 rounded mx-0.5 border border-[#FFB4B4] animate-pulse cursor-help" title="违禁词">{p}</span>;
    return <span key={i}>{p}</span>;
  });

  const renderPrompterText = (t) => t.split(/(\*.*?\*|\|+|\n|↑|↓|【.*?】|\(建议改为：.*?\))/g).map((p, i) => {
    if (p === '|') return <span key={i} className="inline-block w-4 h-4 mx-2 rounded-full bg-[#EF4444]/40 align-middle"></span>;
    if (p === '||') return <span key={i} className="inline-block w-8 h-8 mx-2 rounded-full bg-[#EF4444] align-middle border-2 border-white/50"></span>;
    if (p === '\n') return <br key={i} />;
    if (p === '↑') return <span key={i} className="inline-block text-[#EF4444] font-black text-[1.2em] align-top mx-1">↗</span>;
    if (p === '↓') return <span key={i} className="inline-block text-[#3B82F6] font-black text-[1.2em] align-bottom mx-1">↘</span>;
    if (p.startsWith('【')) return <span key={i} className="text-red-400 bg-red-900/50 px-1 rounded border border-red-500 mx-1">{p}</span>;
    if (p.startsWith('(建议')) return <span key={i} className="text-[#10B981] text-[0.6em] mx-1 opacity-80">{p}</span>;
    if (p.startsWith('*')) return <span key={i} className="text-[#A855F7] font-black text-[1.2em] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mx-1 underline decoration-4 decoration-[#7C3AED]">{p.replace(/\*/g, '')}</span>;
    return <span key={i}>{p}</span>;
  });

  const getVoiceName = (uri) => {
    const v = systemVoices.find(voice => voice.voiceURI === uri);
    return v ? `${v.name} (${v.lang})` : '默认语音';
  };

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-gray-700 font-sans selection:bg-[#BFDBFE]">

      <CustomModal
        isOpen={modalConfig.isOpen}
        type={modalConfig.type}
        content={modalConfig.content}
        onConfirm={modalConfig.onConfirm}
        onClose={closeModal}
      />

      {/* --- 话题输入弹窗 --- */}
      {topicModal.isOpen && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-lg max-w-sm w-full p-8 border border-[#FFFFFF] flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-sm ${topicModal.mode === 'sales' ? 'bg-[#3B82F6] text-white' : topicModal.mode === 'short-video' ? 'bg-[#F59E0B] text-white' : 'bg-[#CDB4DB] text-white'}`}>
              {topicModal.mode === 'sales' ? <ShoppingBag size={32} /> : topicModal.mode === 'short-video' ? <Film size={32} /> : <GraduationCap size={32} />}
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">
              {/* 【修改】短视频逻辑弹窗文案：标题改成"你要录什么内容？" */}
              {topicModal.mode === 'sales' ? '你要卖什么产品？' : topicModal.mode === 'short-video' ? '你要录什么内容？' : '你要卖什么课程？'}
            </h3>
            <p className="text-sm text-gray-500 mb-6 text-center">
              {/* 【修改】短视频逻辑弹窗文案：副提示改成"AI 将根据您输入的主题，为您生成一套强吸引短视频口播话术。" */}
              AI 将根据您输入的主题，为您生成一套{topicModal.mode === 'sales' ? '高转化卖货' : topicModal.mode === 'short-video' ? '强吸引短视频' : '强吸引卖课'}口播话术。
            </p>
            <input
              type="text"
              autoFocus
              placeholder={topicModal.mode === 'sales' ? "例如：扫地机器人、美白面膜..." : topicModal.mode === 'short-video' ? "例如：美食探店、旅游攻略..." : "例如：Python编程、初中英语..."}
              className="w-full p-4 bg-[#F9FAFB] border-2 border-[#EFF6FF] rounded-2xl text-center font-bold text-gray-700 focus:border-[#3B82F6] focus:ring-0 outline-none mb-6 transition-all"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateDraft(topicModal.mode, topicInput)}
            />
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setTopicModal({ isOpen: false, mode: 'sales' })}
                className="flex-1 py-3 px-4 bg-[#F9FAFB] text-gray-600 rounded-xl font-bold hover:bg-[#EFF6FF] transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => generateDraft(topicModal.mode, topicInput)}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${topicModal.mode === 'sales' ? 'bg-[#3B82F6] hover:bg-[#8B5CF6]' : topicModal.mode === 'short-video' ? 'bg-[#F59E0B] hover:bg-[#D97706]' : 'bg-[#CDB4DB] hover:bg-[#BDA4D4]'}`}
              >
                <Sparkles size={18} /> 生成话术
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 【新增】Seedance 提示词弹窗和「生成提示词」按钮的逻辑 */}
      {showSeedanceModal && (
        <div className="fixed inset-0 z-[125] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#EFF6FF] flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <ImageIcon className="text-purple-600" size={24} />
                Seedance 提示词优化
              </h3>
              <button onClick={() => setShowSeedanceModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 bg-purple-50 p-3 rounded-xl border border-purple-100 leading-relaxed">
              用简单的中文描述你想拍摄的场景，AI 将自动生成专业的 Seedance 英文提示词，可用于视频生成工具。
            </p>
            <div className="flex flex-col gap-4 flex-1">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">场景描述</label>
                <textarea
                  autoFocus
                  className="w-full h-24 p-3 bg-[#F9FAFB] border border-[#EFF6FF] rounded-xl text-sm focus:ring-2 focus:ring-purple-200 outline-none resize-none"
                  placeholder="简单用中文描述你想拍的场景，例如：我和李小龙在香港天台大斗…"
                  value={seedanceInput}
                  onChange={(e) => setSeedanceInput(e.target.value)}
                />
              </div>
              <button
                onClick={generateSeedancePrompt}
                disabled={isAiLoading}
                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${
                  isAiLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                }`}
              >
                {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                生成提示词
              </button>
              {seedancePrompt && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">生成的提示词（可编辑）</label>
                  <textarea
                    className="w-full h-32 p-3 bg-[#F9FAFB] border border-[#EFF6FF] rounded-xl text-sm focus:ring-2 focus:ring-purple-200 outline-none resize-none font-mono leading-relaxed"
                    value={seedancePrompt}
                    onChange={(e) => setSeedancePrompt(e.target.value)}
                  />
                </div>
              )}
            </div>
            {seedancePrompt && (
              <div className="mt-4 pt-4 border-t border-[#EFF6FF]/50">
                <button
                  onClick={() => { playClickSound(); setShowSeedanceModal(false); }}
                  className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                >
                  完成
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 【新增】爆款标题弹窗 - 新增的「爆款标题」按钮及其弹窗逻辑 */}
      {showViralTitleModal && (
        <div className="fixed inset-0 z-[125] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#EFF6FF] flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <Star className="text-orange-500" size={24} />
                爆款标题生成
              </h3>
              <button onClick={() => setShowViralTitleModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 bg-orange-50 p-3 rounded-xl border border-orange-100 leading-relaxed">
              简单描述你的视频/产品主题，AI 将自动生成 8 条适合短视频/小红书的吸睛标题。
            </p>
            <div className="flex flex-col gap-4 flex-1">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">主题描述</label>
                <textarea
                  autoFocus
                  className="w-full h-24 p-3 bg-[#F9FAFB] border border-[#EFF6FF] rounded-xl text-sm focus:ring-2 focus:ring-orange-200 outline-none resize-none"
                  placeholder="简单描述你的视频/产品主题，例如：教小学生记单词的方法"
                  value={viralTitleInput}
                  onChange={(e) => setViralTitleInput(e.target.value)}
                />
              </div>
              <button
                onClick={generateViralTitle}
                disabled={isAiLoading}
                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${
                  isAiLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700'
                }`}
              >
                {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                生成标题
              </button>
              {viralTitleResult && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">生成的标题（可编辑）</label>
                  <textarea
                    className="w-full h-32 p-3 bg-[#F9FAFB] border border-[#EFF6FF] rounded-xl text-sm focus:ring-2 focus:ring-orange-200 outline-none resize-none font-mono leading-relaxed"
                    value={viralTitleResult}
                    onChange={(e) => setViralTitleResult(e.target.value)}
                  />
                </div>
              )}
            </div>
            {viralTitleResult && (
              <div className="mt-4 pt-4 border-t border-[#EFF6FF]/50">
                <button
                  onClick={() => { playClickSound(); setShowViralTitleModal(false); }}
                  className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                >
                  完成
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 【新增】爆款封面提示词弹窗 - 新增的「爆款封面提示词」按钮及其弹窗逻辑 */}
      {showCoverPromptModal && (
        <div className="fixed inset-0 z-[125] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#EFF6FF] flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <ImageIcon className="text-blue-600" size={24} />
                爆款封面提示词生成
              </h3>
              <button onClick={() => setShowCoverPromptModal(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 bg-blue-50 p-3 rounded-xl border border-blue-100 leading-relaxed">
              简单描述你想要的封面画面，AI 将自动生成专门适合 Nano Banana 的英文提示词，用来快速出封面图。
            </p>
            <div className="flex flex-col gap-4 flex-1">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">画面描述</label>
                <textarea
                  autoFocus
                  className="w-full h-24 p-3 bg-[#F9FAFB] border border-[#EFF6FF] rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none"
                  placeholder="简单描述你想要的封面画面，例如：一个老师在教室里，黑板上写着单词"
                  value={coverPromptInput}
                  onChange={(e) => setCoverPromptInput(e.target.value)}
                />
              </div>
              <button
                onClick={generateCoverPrompt}
                disabled={isAiLoading}
                className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${
                  isAiLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700'
                }`}
              >
                {isAiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                生成封面提示词
              </button>
              {coverPromptResult && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-2">生成的提示词（可编辑）</label>
                  <textarea
                    className="w-full h-32 p-3 bg-[#F9FAFB] border border-[#EFF6FF] rounded-xl text-sm focus:ring-2 focus:ring-blue-200 outline-none resize-none font-mono leading-relaxed"
                    value={coverPromptResult}
                    onChange={(e) => setCoverPromptResult(e.target.value)}
                  />
                </div>
              )}
            </div>
            {coverPromptResult && (
              <div className="mt-4 pt-4 border-t border-[#EFF6FF]/50">
                <button
                  onClick={() => { playClickSound(); setShowCoverPromptModal(false); }}
                  className="w-full py-2.5 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors"
                >
                  完成
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- 话题输入弹窗 --- */}
      {topicModal.isOpen && (
        <div className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-8 border border-gray-100 flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-sm ${topicModal.mode === 'sales' ? 'bg-indigo-100 text-indigo-600' : topicModal.mode === 'short-video' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
              {topicModal.mode === 'sales' ? <ShoppingBag size={32} /> : topicModal.mode === 'short-video' ? <Film size={32} /> : <GraduationCap size={32} />}
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">
              {/* 【新增】为短视频模式定制文案 */}
              {topicModal.mode === 'sales' ? '你要卖什么产品？' : topicModal.mode === 'short-video' ? '你要录什么内容？' : '你要卖什么课程？'}
            </h3>
            <p className="text-sm text-gray-500 mb-6 text-center">
              {/* 【新增】为短视频模式定制提示文案 */}
              AI 将根据您输入的主题，为您生成一套{topicModal.mode === 'sales' ? '高转化卖货' : topicModal.mode === 'short-video' ? '强吸引短视频' : '强吸引卖课'}口播话术。
            </p>
            <input
              type="text"
              autoFocus
              placeholder={topicModal.mode === 'sales' ? "例如：扫地机器人、美白面膜..." : topicModal.mode === 'short-video' ? "例如：美食探店、旅游攻略..." : "例如：Python编程、初中英语..."}
              className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-2xl text-center font-bold text-gray-700 focus:border-indigo-500 focus:ring-0 outline-none mb-6 transition-all"
              value={topicInput}
              onChange={(e) => setTopicInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateDraft(topicModal.mode, topicInput)}
            />
            <div className="flex gap-3 w-full">
              <button
                onClick={() => setTopicModal({ isOpen: false, mode: 'sales' })}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                onClick={() => generateDraft(topicModal.mode, topicInput)}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${topicModal.mode === 'sales' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : topicModal.mode === 'short-video' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
              >
                <Sparkles size={18} /> 生成话术
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 自定义违禁词设置弹窗 */}
      {showBannedSettings && (
        <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6 border border-[#FFFFFF]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ShieldCheck className="text-red-500" size={20} /> 自定义违禁词
              </h3>
              <button onClick={() => setShowBannedSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-2">输入您想屏蔽的词（如品牌名、竞品名等），用逗号、空格或换行分隔。系统在扫描时会自动将这些词高亮。</p>
            <textarea
              className="w-full h-32 p-3 bg-[#F9FAFB] border border-[#EFF6FF] rounded-xl text-sm focus:ring-2 focus:ring-[#BFDBFE] outline-none resize-none mb-4"
              placeholder="例如：第一, 最强, 竞品A, 绝对"
              value={customBannedWords}
              onChange={(e) => setCustomBannedWords(e.target.value)}
            />
            <button onClick={() => { playClickSound(); setShowBannedSettings(false); }} className="w-full py-2.5 bg-[#3B82F6] hover:bg-[#8B5CF6] text-white rounded-xl font-bold transition-colors shadow-lg flex items-center justify-center gap-2">
              <Save size={16} /> 保存设置
            </button>
          </div>
        </div>
      )}

      {/* AI改写规则设置弹窗 */}
      {showRewriteSettings && (
        <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-lg max-w-md w-full p-6 border border-[#FFFFFF] flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <FileText className="text-emerald-500" size={24} />
                {/* 【新增】短视频模式标题 */}
                {editingConfigMode === 'sales' ? '自定义卖货逻辑' : editingConfigMode === 'short-video' ? '自定义短视频逻辑' : '自定义卖课逻辑'}
              </h3>
              <button onClick={() => setShowRewriteSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            {/* 【新增】产品名/课程名输入框 */}
            {editingConfigMode !== 'short-video' && (
              <div className="mb-3">
                <label className="block text-xs font-bold text-gray-500 mb-2">
                  {editingConfigMode === 'sales' ? '产品名（必填）' : '课程名（必填）'}
                </label>
                <input
                  type="text"
                  className="w-full p-3 bg-[#F9FAFB] border border-[#EFF6FF] rounded-xl text-sm focus:ring-2 focus:ring-[#BFDBFE] outline-none transition-all"
                  placeholder={editingConfigMode === 'sales' ? '例如：扫地机器人' : '例如：Python编程入门课'}
                  value={editingConfigMode === 'sales' ? productTitle : courseTitle}
                  onChange={(e) => {
                    if (editingConfigMode === 'sales') {
                      setProductTitle(e.target.value);
                    } else {
                      setCourseTitle(e.target.value);
                    }
                  }}
                />
              </div>
            )}

              {/* 【修改】短视频公式选择控件（替代原来的三个字段）- 新增 5 个爆款公式 */}
              {editingConfigMode === 'short-video' && (
                <div className="mb-4">
                  <label className="block text-xs font-bold text-gray-500 mb-2">选择爆款公式</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      onClick={() => { playClickSound(); setShortVideoFormula('formula_1'); setRewriteRules(prev => ({ ...prev, 'short-video': getShortVideoFormulaTemplate('formula_1') })); }}
                      className={`p-2 rounded-lg text-xs font-bold transition-colors text-left ${shortVideoFormula === 'formula_1' ? 'bg-[#F59E0B] text-white' : 'bg-[#F9FAFB] text-gray-600 hover:bg-[#FFF0F0]'}`}
                    >
                      🔍 痛点提问型 - 开头戳中痛点，中间给方案，结尾引导行动
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShortVideoFormula('formula_2'); setRewriteRules(prev => ({ ...prev, 'short-video': getShortVideoFormulaTemplate('formula_2') })); }}
                      className={`p-2 rounded-lg text-xs font-bold transition-colors text-left ${shortVideoFormula === 'formula_2' ? 'bg-[#F59E0B] text-white' : 'bg-[#F9FAFB] text-gray-600 hover:bg-[#FFF0F0]'}`}
                    >
                      📊 反差对比型 - 前后对比展示差异，突出产品价值
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShortVideoFormula('formula_3'); setRewriteRules(prev => ({ ...prev, 'short-video': getShortVideoFormulaTemplate('formula_3') })); }}
                      className={`p-2 rounded-lg text-xs font-bold transition-colors text-left ${shortVideoFormula === 'formula_3' ? 'bg-[#F59E0B] text-white' : 'bg-[#F9FAFB] text-gray-600 hover:bg-[#FFF0F0]'}`}
                    >
                      🎬 故事悬念型 - 故事开头制造悬念，引出产品
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShortVideoFormula('formula_4'); setRewriteRules(prev => ({ ...prev, 'short-video': getShortVideoFormulaTemplate('formula_4') })); }}
                      className={`p-2 rounded-lg text-xs font-bold transition-colors text-left ${shortVideoFormula === 'formula_4' ? 'bg-[#F59E0B] text-white' : 'bg-[#F9FAFB] text-gray-600 hover:bg-[#FFF0F0]'}`}
                    >
                      📋 清单干货型 - "3个方法""5个技巧"快速传递价值
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShortVideoFormula('formula_5'); setRewriteRules(prev => ({ ...prev, 'short-video': getShortVideoFormulaTemplate('formula_5') })); }}
                      className={`p-2 rounded-lg text-xs font-bold transition-colors text-left ${shortVideoFormula === 'formula_5' ? 'bg-[#F59E0B] text-white' : 'bg-[#F9FAFB] text-gray-600 hover:bg-[#FFF0F0]'}`}
                    >
                      🏆 权威背书型 - 引用专家观点、用户好评增强可信度
                    </button>
                    {/* 新增 5 个爆款公式 */}
                    <button
                      onClick={() => { playClickSound(); setShortVideoFormula('formula_6'); setRewriteRules(prev => ({ ...prev, 'short-video': getShortVideoFormulaTemplate('formula_6') })); }}
                      className={`p-2 rounded-lg text-xs font-bold transition-colors text-left ${shortVideoFormula === 'formula_6' ? 'bg-[#F59E0B] text-white' : 'bg-[#F9FAFB] text-gray-600 hover:bg-[#FFF0F0]'}`}
                    >
                      💢 反套路吐槽型 - 用吐槽或反套路的方式揭露行业乱象或产品槽点
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShortVideoFormula('formula_7'); setRewriteRules(prev => ({ ...prev, 'short-video': getShortVideoFormulaTemplate('formula_7') })); }}
                      className={`p-2 rounded-lg text-xs font-bold transition-colors text-left ${shortVideoFormula === 'formula_7' ? 'bg-[#F59E0B] text-white' : 'bg-[#F9FAFB] text-gray-600 hover:bg-[#FFF0F0]'}`}
                    >
                      🎭 角色扮演型 - 设定一个角色（如闺蜜、老师、专家），以角色口吻进行推荐
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShortVideoFormula('formula_8'); setRewriteRules(prev => ({ ...prev, 'short-video': getShortVideoFormulaTemplate('formula_8') })); }}
                      className={`p-2 rounded-lg text-xs font-bold transition-colors text-left ${shortVideoFormula === 'formula_8' ? 'bg-[#F59E0B] text-white' : 'bg-[#F9FAFB] text-gray-600 hover:bg-[#FFF0F0]'}`}
                    >
                      📰 新闻播报型 - 用新闻播报的形式，严肃、专业地介绍产品或资讯
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShortVideoFormula('formula_9'); setRewriteRules(prev => ({ ...prev, 'short-video': getShortVideoFormulaTemplate('formula_9') })); }}
                      className={`p-2 rounded-lg text-xs font-bold transition-colors text-left ${shortVideoFormula === 'formula_9' ? 'bg-[#F59E0B] text-white' : 'bg-[#F9FAFB] text-gray-600 hover:bg-[#FFF0F0]'}`}
                    >
                      ❓ FAQ 问答型 - 通过问答形式介绍产品，一问一答，清晰明了
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShortVideoFormula('formula_10'); setRewriteRules(prev => ({ ...prev, 'short-video': getShortVideoFormulaTemplate('formula_10') })); }}
                      className={`p-2 rounded-lg text-xs font-bold transition-colors text-left ${shortVideoFormula === 'formula_10' ? 'bg-[#F59E0B] text-white' : 'bg-[#F9FAFB] text-gray-600 hover:bg-[#FFF0F0]'}`}
                    >
                      💬 对话剧情型 - 设置一个对话场景，在对话中自然介绍产品
                    </button>
                  </div>
                </div>
              )}

            {/* 【修改】短视频逻辑文本框高度调整为 240px，其他逻辑保持 400px */}
            <textarea
              className={`flex-1 min-h-[${editingConfigMode === 'short-video' ? '240px' : '400px'}] w-full p-4 bg-[#F9FAFB] border border-[#EFF6FF] rounded-xl text-sm focus:ring-2 focus:ring-[#BFDBFE] outline-none resize-none mb-4 font-mono leading-relaxed`}
              value={rewriteRules[editingConfigMode]}
              onChange={(e) => setRewriteRules(prev => ({ ...prev, [editingConfigMode]: e.target.value }))}
            />

            <div className="flex gap-3">
              <button onClick={handleResetRewriteRules} className="px-4 py-2.5 bg-[#F9FAFB] text-gray-600 rounded-xl font-bold hover:bg-[#EFF6FF] transition-colors flex items-center gap-2 text-xs">
                <RotateCcw size={14} /> 恢复默认
              </button>
              <button onClick={() => { playClickSound(); localStorage.setItem('short_video_formula', shortVideoFormula); setShowRewriteSettings(false); }} className="flex-1 py-2.5 bg-[#10B981] hover:bg-[#6BC847] text-white rounded-xl font-bold transition-colors shadow-lg flex items-center justify-center gap-2">
                <Save size={16} /> 保存设置
              </button>
              {/* 【新增】生成话术按钮 */}
              <button
                onClick={() => {
                  playClickSound();
                  const title = editingConfigMode === 'sales' ? productTitle : editingConfigMode === 'course' ? courseTitle : '';
                  generateDraft(editingConfigMode, title);
                }}
                className={`py-2.5 px-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 text-xs ${
                  editingConfigMode === 'sales' ? 'bg-[#3B82F6] hover:bg-[#8B5CF6]' : editingConfigMode === 'short-video' ? 'bg-[#F59E0B] hover:bg-[#D97706]' : 'bg-[#CDB4DB] hover:bg-[#BDA4D4]'
                }`}
              >
                <Sparkles size={14} /> 生成话术
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 升级弹窗 --- */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSubscribe={handleSubscribe}
      />

      {/* 浏览器 TTS 设置弹窗 */}
      {showVoiceSettings && (
        <div className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-lg border-2 border-[#EFF6FF]">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black flex items-center gap-2 text-gray-800">
                <Volume2 className="text-[#3B82F6]" size={20} /> 浏览器朗读设置
              </h3>
              <button onClick={() => setShowVoiceSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="space-y-6">
              {ttsError && (
                <div className="mb-4 p-3 bg-[#F9FAFB] border border-[#FFB4B4] text-red-600 text-xs rounded-xl flex items-start gap-2 animate-in slide-in-from-top-2 shadow-sm">
                  <AlertTriangle size={20} className="shrink-0 mt-0.5" />
                  <div className="whitespace-pre-wrap font-medium leading-relaxed">{ttsError}</div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">
                  选择声音 ({systemVoices.length} 个可用)
                </label>
                <div className="relative">
                  <select
                    value={selectedVoiceURI}
                    onChange={(e) => setSelectedVoiceURI(e.target.value)}
                    className="w-full p-3 bg-[#F9FAFB] border border-[#EFF6FF] rounded-xl appearance-none outline-none focus:ring-2 focus:ring-[#BFDBFE] text-sm font-medium"
                  >
                    {systemVoices.map(v => (
                      <option key={v.voiceURI} value={v.voiceURI}>
                        {v.name} ({v.lang}) {v.name.includes('Microsoft') ? '✨' : ''}
                      </option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-3.5 text-gray-400 pointer-events-none">
                    <ChevronRight size={16} className="rotate-90" />
                  </div>
                </div>
                <p className="text-[10px] text-gray-400 mt-2 flex items-center gap-1">
                  <Info size={10} />
                  <span>推荐使用 Edge 浏览器，拥有最自然的 Microsoft 中文语音。</span>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide flex justify-between">
                  <span>朗读语速</span>
                  <span className="text-[#3B82F6]">{ttsRate}x</span>
                </label>
                <input
                  type="range" min="0.5" max="2.0" step="0.1"
                  value={ttsRate}
                  onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                  className="w-full accent-[#3B82F6] h-2 bg-[#EFF6FF] rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide flex justify-between">
                  <span>朗读音调</span>
                  <span className="text-[#3B82F6]">{ttsPitch}</span>
                </label>
                <input
                  type="range" min="0.5" max="2.0" step="0.1"
                  value={ttsPitch}
                  onChange={(e) => setTtsPitch(parseFloat(e.target.value))}
                  className="w-full accent-[#3B82F6] h-2 bg-[#EFF6FF] rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-[#EFF6FF] flex justify-end">
                <button onClick={() => { playClickSound(); setShowVoiceSettings(false); setTtsError(''); }} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg">
                  确认
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 管理员设置弹窗 (修正 Bug：允许输入 Key) */}
      {showSettings && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-lg max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold flex items-center gap-2">🛠️ 设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-gray-400 hover:text-gray-600"><X /></button>
            </div>

            {/* TTS 配置部分 */}
            <h3 className="text-xl font-bold flex items-center gap-2 mb-4">🔊 语音合成配置 (TTS)</h3>

            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">选择语音服务商</label>
              <div className="flex gap-2 flex-wrap">
                {Object.keys(TTS_PROVIDERS).map(k => (
                  <button key={k} onClick={() => saveTtsConfig({ ...ttsConfig, provider: k })} className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${ttsConfig.provider === k ? 'bg-[#3B82F6] text-white border-[#3B82F6]' : 'bg-white text-gray-600 border-[#EFF6FF]'}`}>
                    {TTS_PROVIDERS[k].name}
                  </button>
                ))}
              </div>
            </div>

            {ttsConfig.provider === 'aliyun' && (
              <div className="space-y-3 bg-[#F9FAFB] p-4 rounded-xl border border-[#EFF6FF]">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">AppKey</label>
                  <input type="password" value={ttsConfig.aliyun.appKey} onChange={e => saveTtsConfig({ ...ttsConfig, aliyun: { ...ttsConfig.aliyun, appKey: e.target.value } })} className="w-full p-2 bg-white border border-[#EFF6FF] rounded-lg text-sm" placeholder="输入 AppKey" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">AccessKey ID</label>
                  <input type="password" value={ttsConfig.aliyun.accessKeyId} onChange={e => saveTtsConfig({ ...ttsConfig, aliyun: { ...ttsConfig.aliyun, accessKeyId: e.target.value } })} className="w-full p-2 bg-white border border-[#EFF6FF] rounded-lg text-sm" placeholder="输入 AccessKey ID" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">AccessKey Secret</label>
                  <input type="password" value={ttsConfig.aliyun.accessKeySecret} onChange={e => saveTtsConfig({ ...ttsConfig, aliyun: { ...ttsConfig.aliyun, accessKeySecret: e.target.value } })} className="w-full p-2 bg-white border border-[#EFF6FF] rounded-lg text-sm" placeholder="输入 AccessKey Secret" />
                </div>
              </div>
            )}

            {ttsConfig.provider === 'volcengine' && (
              <div className="space-y-3 bg-[#F9FAFB] p-4 rounded-xl border border-[#EFF6FF]">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">AppId</label>
                  <input type="text" value={ttsConfig.volcengine.appId} onChange={e => saveTtsConfig({ ...ttsConfig, volcengine: { ...ttsConfig.volcengine, appId: e.target.value } })} className="w-full p-2 bg-white border border-[#EFF6FF] rounded-lg text-sm" placeholder="输入 AppId" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Access Token</label>
                  <input type="password" value={ttsConfig.volcengine.accessToken} onChange={e => saveTtsConfig({ ...ttsConfig, volcengine: { ...ttsConfig.volcengine, accessToken: e.target.value } })} className="w-full p-2 bg-white border border-[#EFF6FF] rounded-lg text-sm" placeholder="输入 Access Token" />
                </div>
              </div>
            )}

            {ttsConfig.provider === 'azure' && (
              <div className="space-y-3 bg-[#F9FAFB] p-4 rounded-xl border border-[#EFF6FF]">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Subscription Key</label>
                  <input type="password" value={ttsConfig.azure.key} onChange={e => saveTtsConfig({ ...ttsConfig, azure: { ...ttsConfig.azure, key: e.target.value } })} className="w-full p-2 bg-white border border-[#EFF6FF] rounded-lg text-sm" placeholder="输入 Subscription Key" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Region</label>
                  <input type="text" value={ttsConfig.azure.region} onChange={e => saveTtsConfig({ ...ttsConfig, azure: { ...ttsConfig.azure, region: e.target.value } })} className="w-full p-2 bg-white border border-[#EFF6FF] rounded-lg text-sm" placeholder="例如: eastus" />
                </div>
              </div>
            )}

            <button onClick={() => { playClickSound(); setShowSettings(false); }} className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors mt-4">关闭</button>
          </div>
        </div>
      )}

      {/* --- 主界面 --- */}
      <div className={`max-w-6xl mx-auto p-4 md:p-6 transition-all ${isPrompterOpen ? 'hidden' : 'block'}`}>
        <header className="mb-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3 select-none">
            <div onClick={handleSecretClick} className="relative w-12 h-12 bg-gradient-to-br from-[#3B82F6] to-[#8B5CF6] rounded-[18px] flex items-center justify-center shadow-lg cursor-pointer active:scale-90 transition-transform">
              <Monitor className="text-white" size={24} />
              {secretCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#A855F7] rounded-full text-[10px] flex items-center justify-center text-white font-bold animate-bounce">{8 - secretCount}</span>}
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-800 tracking-tight">播感大师</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400 font-medium ml-1">试用 3 天，每天 10 次免费生成{!subscription.isPro && `，今日剩余：${Math.max(0, subscription.dailyCreditsLimit - subscription.dailyCreditsUsed)} 次`}</p>

                {/* 状态显示胶囊 */}
                {!subscription.isPro && (
                  <div className="flex gap-1.5 ml-2">
                    {subscription.trialEnd && new Date(subscription.trialEnd) > new Date() && (
                      <>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border bg-[#F9FAFB] text-[#3B82F6] border-[#BFDBFE]">
                          <Clock size={10} /> 试用中
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${subscription.dailyCreditsUsed >= subscription.dailyCreditsLimit ? 'bg-red-50 text-red-500 border-red-100' : 'bg-[#F9FAFB] text-[#3B82F6] border-[#BFDBFE]'}`}>
                          <Zap size={10} /> {subscription.dailyCreditsLimit - subscription.dailyCreditsUsed}点
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => { playClickSound(); showMessage('使用规则：\n1. 点击【AI 违禁词过滤】识别极限词（支持点击设置按钮添加自定义词库）。\n2. 点击【AI 播感标注】自动添加停顿和重音。\n3. 点击【卖货型】或【卖课型】按钮后，输入具体产品名或课程名，即可自动生成文案。\n4. 点击【AI 改写】旁的设置按钮，会出现二级菜单，支持自定义卖货和卖课的话术逻辑。\n5. 新用户试用 3 天，每天 10 点数。\n6. 开通会员可无限畅享所有功能。\n7. 导出 JSON 是为了后续制作短视频使用，方便把脚本导入到其他剪辑或自动化工具中。'); }} className="flex items-center gap-2 px-4 py-3 bg-white border border-[#EFF6FF] text-gray-600 rounded-full font-bold hover:bg-[#F9FAFB] transition-colors shadow-sm active:scale-95">
              <CircleHelp size={18} /><span className="hidden md:inline">规则</span>
            </button>

            <SubscriptionButton subscription={subscription} onUpgrade={() => setShowUpgradeModal(true)} />

            {/* 试听-查错字按钮组 */}
            <div className="flex items-center bg-white border border-[#EFF6FF] rounded-full p-1 pl-1 pr-1 shadow-sm">
              <button
                onClick={handleSpeakToggle}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all active:scale-95 ${isReading ? 'bg-[#F9FAFB] text-[#3B82F6]' : 'hover:bg-[#F9FAFB] text-gray-600'}`}
              >
                {isReading ? <PauseCircle size={18} /> : <Speaker size={18} />}
                <span className="text-sm">{isReading ? '停止' : '试听-查错字'}</span>
              </button>
              <div className="w-px h-4 bg-[#EFF6FF] mx-1"></div>
              <button
                onClick={() => setShowVoiceSettings(true)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-[#F9FAFB] transition-colors"
              >
                <Settings2 size={16} />
              </button>
            </div>

            <button onClick={() => { playClickSound(); setIsPrompterOpen(true); }} className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] hover:from-[#8B5CF6] hover:to-[#2563EB] text-white rounded-full font-bold shadow-lg transition-all hover:scale-105 active:scale-95">
              <Play size={20} fill="currentColor" /> 开始提词 🎬
            </button>

            {/* 【恢复】三个导出按钮 */}
            <button
              onClick={handleExportWord}
              disabled={isExportingWord || !text || text.trim().length === 0}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 ${
                isExportingWord || !text || text.trim().length === 0
                  ? 'bg-[#F9FAFB] text-gray-400 cursor-not-allowed'
                  : 'bg-white text-[#10B981] border border-[#B4F4B4] hover:bg-[#F0FFF0] hover:border-[#9EF49E]'
              }`}
              title="导出为 Word 文档"
            >
              {isExportingWord ? <Loader2 size={12} className="animate-spin" /> : <FileText size={14} />}
              <span className="hidden sm:inline">导出 Word</span>
            </button>
            <button
              onClick={handleExportJson}
              disabled={isExportingJson || !text || text.trim().length === 0}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 ${
                isExportingJson || !text || text.trim().length === 0
                  ? 'bg-[#F9FAFB] text-gray-400 cursor-not-allowed'
                  : 'bg-white text-[#3B82F6] border border-[#BFDBFE] hover:bg-[#EFF6FF] hover:border-[#3B82F6]'
              }`}
              title="导出为 SRT 字幕文件，支持导入剪映"
            >
              {isExportingJson ? <Loader2 size={12} className="animate-spin" /> : <FileText size={14} />}
              <span className="hidden sm:inline">导出 SRT</span>
            </button>
            {/* 【修改】"导出json"按钮（原导出kling按钮位置） */}
            {/* 【新增】导出json 右侧下拉菜单 + Seedance 提示词入口 */}
            <div className="flex gap-0.5 relative">
              <button
                onClick={handleExportKling}
                disabled={isExportingKling || !text || text.trim().length === 0}
                className={`flex items-center gap-1.5 px-3 py-2.5 rounded-l-xl font-bold text-xs transition-all shadow-sm active:scale-95 border-2 border-r-0 ${
                  isExportingKling || !text || text.trim().length === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 hover:shadow-md border-transparent'
                }`}
                title="导出通用 JSON 字幕/片段文件，支持多个视频工具"
              >
                {isExportingKling ? <Loader2 size={12} className="animate-spin" /> : <Code size={14} />}
                <span className="hidden sm:inline">导出 JSON</span>
              </button>
              <button
                onClick={() => { playClickSound(); setShowExportMoreMenu(!showExportMoreMenu); }}
                className={`px-2 py-2.5 rounded-r-xl text-xs transition-all border-2 border-l-0 ${
                  !text || text.trim().length === 0
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300'
                    : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 border-transparent'
                }`}
                title="更多选项"
              >
                <ChevronDown size={14} />
              </button>

              {/* 导出更多下拉菜单 */}
              {showExportMoreMenu && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-[#EFF6FF] z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                  <button
                    onClick={() => { playClickSound(); setShowExportMoreMenu(false); setShowSeedanceModal(true); }}
                    className="w-full text-left px-4 py-3 text-xs font-bold text-gray-600 hover:bg-[#F9FAFB] hover:text-[#3B82F6] transition-colors flex items-center gap-2"
                  >
                    <ImageIcon size={14} /> Seedance 提示词
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-160px)]">
          {/* 左侧编辑器 */}
          <div className="flex flex-col bg-white rounded-[20px] shadow-lg border border-[#EFF6FF] overflow-hidden relative group">
            {isAiLoading && <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-[#3B82F6]"><Loader2 size={40} className="animate-spin mb-2" /><p className="font-bold">{aiStatus}</p></div>}

            {/* --- 工具栏 --- */}
            <div className="bg-gradient-to-b from-white to-[#F9FAFB]/50 p-4 border-b border-[#EFF6FF] space-y-4">

              <div className="flex flex-wrap lg:flex-nowrap gap-4 items-center justify-between">

                {/* 语气模板选择 */}
                <div className="flex flex-col w-full lg:w-auto">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">内容生成</span>
                  <div className="flex bg-[#F9FAFB] p-1 rounded-xl shrink-0">
                    <button
                      onClick={() => handleModeClick('sales')} // 【修改】卖货型按钮：切到自定义卖货逻辑
                      className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${aiMode === 'sales' ? 'bg-white text-[#3B82F6] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <ShoppingBag size={14} /> 卖货型
                    </button>
                    <button
                      onClick={() => handleModeClick('course')} // 【修改】卖课型按钮：切到自定义卖课逻辑
                      className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${aiMode === 'course' ? 'bg-white text-[#CDB4DB] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <GraduationCap size={14} /> 卖课型
                    </button>
                    {/* 【修改】短视频按钮：切到短视频逻辑 */}
                    <button
                      onClick={() => handleModeClick('short-video')}
                      className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${aiMode === 'short-video' ? 'bg-white text-[#F59E0B] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      <Film size={14} /> 短视频
                    </button>
                  </div>
                </div>

                {/* AI 动作按钮组 */}
                <div className="flex flex-wrap gap-2 w-full lg:w-auto">

                  {/* 违禁词过滤 + 设置组合按钮 */}
                  <div className="flex-1 min-w-[100px] flex gap-0.5">
                    <button
                      onClick={handleBannedPanelToggle} // 修改：点击展开/收起违禁词侧边面板
                      className="flex-grow flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F9FAFB] text-red-600 border border-[#FFB4B4] rounded-l-xl rounded-r-none shadow-sm font-bold transition-transform active:scale-95 hover:bg-[#FFFFFF]"
                      title="展开/收起违禁词检查面板"
                    >
                      <ShieldCheck size={16} /> <span className="text-xs">违禁词</span>
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShowBannedSettings(true); }}
                      className="flex items-center justify-center px-2 bg-[#F9FAFB] text-red-400 border border-l-0 border-[#FFB4B4] rounded-r-xl hover:bg-[#FFFFFF] transition-colors"
                      title="添加自定义违禁词"
                    >
                      <Settings2 size={14} />
                    </button>
 </div>

                  {/* 【删除】已删除「自定义逻辑」下拉菜单：包括下拉按钮、菜单项列表和点击事件绑定 */}
                  {/* AI 改写按钮 */}
                  <div className="flex-1 min-w-[100px]">
                    <button
                      onClick={callRewrite}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F9FAFB] text-emerald-600 border border-[#B4F4B4] rounded-xl shadow-sm font-bold transition-transform active:scale-95 hover:bg-[#FFFFFF]"
                      title="AI 智能改写 (消耗次数)"
                    >
                      <RefreshCw size={16} /> <span className="text-xs">AI 改写</span>
                    </button>
                  </div>
                  {/* 删除原来的「AI 播感标注」按钮 - 迁移到右侧区域 */}
                </div>
              </div>

              {/* 手动微调工具栏 */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#EFF6FF]/50 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1">手动标记</span>
                <button onClick={() => insertMark('stress')} className="btn-tool text-yellow-600 bg-[#DBEAFE] hover:bg-[#FFF0D6]"><Star size={14} fill="currentColor" /> 重点</button>
                <button onClick={() => insertMark('short')} className="btn-tool text-gray-600 bg-[#F9FAFB] hover:bg-[#EFF6FF]"><GripVertical size={14} /> 短停 |</button>
                <button onClick={() => insertMark('long')} className="btn-tool text-red-600 bg-[#F9FAFB] hover:bg-[#EFF6FF]"><PauseCircle size={14} /> 长停 ||</button>
                <button onClick={() => insertMark('up')} className="btn-tool text-red-600 bg-[#F9FAFB] hover:bg-[#EFF6FF]"><ArrowUpRight size={14} /> 上扬 ↑</button>
                <button onClick={() => insertMark('down')} className="btn-tool text-blue-600 bg-[#F9FAFB] hover:bg-[#EFF6FF]"><ArrowDownRight size={14} /> 收尾 ↓</button>
                <div className="flex-1"></div>
                <button onClick={clearMarks} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-[#F9FAFB] rounded-lg transition-colors" title="清除所有标记"><Eraser size={14} /></button>
              </div>
            </div>

            <textarea ref={textareaRef} className="flex-1 w-full p-6 bg-transparent outline-none resize-none font-sans text-lg leading-relaxed text-gray-600 placeholder-[#B2BEC3]" value={text} onChange={e => setText(e.target.value)} placeholder="在这里写你的口播脚本…" />

            {/* 底部播放状态指示 */}
            {isReading && (
              <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#EFF6FF] p-3 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#F9FAFB] text-[#3B82F6] flex items-center justify-center animate-pulse">
                  <Mic size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-gray-800">正在朗读中...</div>
                  <div className="text-xs text-gray-500 truncate w-64">{getVoiceName(selectedVoiceURI)}</div>
                </div>
                <button
                  onClick={handleSpeakToggle}
                  className="px-4 py-2 bg-[#F9FAFB] hover:bg-[#EFF6FF] text-gray-600 rounded-lg text-sm font-bold transition-colors"
                >
                  停止
                </button>
              </div>
            )}
          </div>

          {/* 【修改】AI 播感标注区域 - 原来是「效果预览」区域 */}
          <div className="flex flex-col bg-white rounded-[20px] shadow-lg border border-[#EFF6FF] overflow-hidden relative">
            <div className="bg-gradient-to-r from-[#F9FAFB] to-[#FFFFFF] p-4 border-b border-[#EFF6FF] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-gray-600 font-bold">
                  <Wand2 size={18} className="text-[#3B82F6]" />
                  <span>AI 播感标注</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* 【新增】爆款标题按钮 - 新增的「爆款标题」按钮 */}
                <button
                  onClick={() => { playClickSound(); setShowViralTitleModal(true); }}
                  disabled={isAiLoading}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 ${
                    isAiLoading
                      ? 'bg-[#F9FAFB] text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-orange-500 to-red-600 text-white hover:from-orange-600 hover:to-red-700 hover:shadow-md'
                  }`}
                  title="生成爆款标题"
                >
                  <Star size={12} />
                  <span>爆款标题</span>
                </button>
                {/* 【新增】爆款封面提示词按钮 - 新增的「爆款封面提示词」按钮 */}
                <button
                  onClick={() => { playClickSound(); setShowCoverPromptModal(true); }}
                  disabled={isAiLoading}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 ${
                    isAiLoading
                      ? 'bg-[#F9FAFB] text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-500 to-cyan-600 text-white hover:from-blue-600 hover:to-cyan-700 hover:shadow-md'
                  }`}
                  title="生成封面提示词"
                >
                  <ImageIcon size={12} />
                  <span>封面提示词</span>
                </button>
                <button
                  onClick={callProsodyAnnotation} // 调用 AI 播感标注函数
                  disabled={isAiLoading}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 ${
                    isAiLoading
                      ? 'bg-[#F9FAFB] text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-[#3B82F6] to-[#8B5CF6] text-white hover:from-[#8B5CF6] hover:to-[#2563EB] hover:shadow-md'
                  }`}
                  title="开始 AI 播感标注"
                >
                  {isAiLoading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Sparkles size={12} />
                  )}
                  <span>{isAiLoading ? '标注中...' : '开始标注'}</span>
                </button>
              </div>
            </div>

            {/* 【新增】AI 播感标注图例说明 */}
            <div className="border-b border-[#EFF6FF]/50 bg-[#F9FAFB]/50 px-6 py-3">
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-gray-400 font-medium">标注说明：</span>
                <span className="flex items-center gap-1 text-gray-600"><span className="w-6 h-6 rounded bg-[#DBEAFE] text-center text-[10px]">|</span> 短停顿</span>
                <span className="flex items-center gap-1 text-gray-600"><span className="w-6 h-6 rounded bg-red-100 text-center text-[10px]">||</span> 长停顿</span>
                <span className="flex items-center gap-1 text-gray-600"><span className="w-6 h-6 rounded bg-[#F9FAFB] border border-[#BFDBFE] text-[#10px] text-[#3B82F6]">*词*</span> 重音</span>
                <span className="flex items-center gap-1 text-gray-600"><span className="w-6 h-6 rounded bg-[#F9FAFB] border border-[#EF4444] text-[10px] text-[#EF4444]">↑</span> 语调上扬</span>
                <span className="flex items-center gap-1 text-gray-600"><span className="w-6 h-6 rounded bg-[#F9FAFB] border border-[#3B82F6] text-[10px] text-[#3B82F6]">↓</span> 语调下沉</span>
              </div>
            </div>

            {/* 【新增】AI 播感标注状态提示 */}
            {aiStatus && (aiStatus.includes('标注') || aiStatus.includes('播感')) && (
              <div className="border-b border-[#EFF6FF] bg-gradient-to-r from-blue-50 to-purple-50 animate-in slide-in-from-top-5 duration-200">
                <div className="px-6 py-3 flex items-center gap-3">
                  {isAiLoading ? (
                    <Loader2 size={18} className="animate-spin text-[#3B82F6]" />
                  ) : (
                    <Wand2 size={18} className="text-[#8B5CF6]" />
                  )}
                  <span className="text-sm font-medium text-gray-700">{aiStatus}</span>
                </div>
              </div>
            )}

            {/* 违禁词检查侧边面板 - 展开时显示 */}
            {showBannedPanel && (
              <div className="border-t border-[#EFF6FF] bg-[#FFF5F5] animate-in slide-in-from-top-10 duration-300">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-red-700 font-bold">
                      <ShieldCheck size={18} />
                      <span>违禁词检查</span>
                    </div>
                    <button onClick={handleBannedPanelToggle} className="text-gray-400 hover:text-gray-600">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={callContrabandCheck} // 点击这个按钮才调用 AI 扫描
                      disabled={isAiLoading}
                      className="flex-1 py-2 px-3 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                    >
                      {isAiLoading ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
                      <span>{isAiLoading ? '扫描中...' : '开始扫描'}</span>
                    </button>
                    <button
                      onClick={() => { playClickSound(); setShowBannedSettings(true); }}
                      className="px-3 py-2 bg-white text-red-600 border border-[#FFB4B4] rounded-lg text-xs font-bold hover:bg-[#FFF0F0] transition-colors flex items-center gap-1"
                    >
                      <Settings2 size={12} />
                      <span>自定义词库</span>
                    </button>
                  </div>
                  {aiStatus && aiStatus.includes('违禁词') && (
                    <div className="mt-2 text-xs text-gray-500 text-center">{aiStatus}</div>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 p-6 overflow-y-auto text-xl leading-loose text-gray-700 font-sans whitespace-pre-wrap">{renderStyledText(text)}</div>
          </div>
        </div>
      </div>

      {/* --- 全屏提词模式 --- */}
      {isPrompterOpen && (
        <div className="fixed inset-0 z-50 bg-gray-900 flex flex-col text-white">
          <div className="flex items-center justify-between px-6 py-4 bg-gray-800/80 backdrop-blur-md z-10">
            <button onClick={() => { playClickSound(); setIsPlaying(false); setIsPrompterOpen(false); }} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors"><X size={24} /></button>
            <div className="flex gap-4 items-center">
              <button onClick={() => { playClickSound(); setIsPlaying(!isPlaying); }} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-[#EF4444] hover:bg-[#FF5252]' : 'bg-[#10B981] hover:bg-[#6BC847]'} shadow-lg`}>
                {isPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" className="ml-1" size={24} />}
              </button>
              <button onClick={() => { playClickSound(); if (scrollerRef.current) scrollerRef.current.scrollTop = 0; setIsPlaying(false); }} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full"><RotateCcw size={20} /></button>
            </div>
            <div className="hidden md:flex gap-6 items-center">
              <div className="flex items-center gap-2"><Type size={16} /><input type="range" min="30" max="150" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="accent-[#3B82F6] h-2 bg-gray-600 rounded-lg appearance-none" /></div>
              <div className="flex items-center gap-2"><Gauge size={16} /><input type="range" min="1" max="10" step="0.5" value={scrollSpeed} onChange={e => setScrollSpeed(Number(e.target.value))} className="accent-[#3B82F6] h-2 bg-gray-600 rounded-lg appearance-none" /></div>
              <button onClick={() => { playClickSound(); setMirrorMode(!mirrorMode); }} className={`px-3 py-1 rounded-lg text-xs font-bold border ${mirrorMode ? 'bg-[#3B82F6] border-[#3B82F6]' : 'border-gray-500'}`}>MIRROR</button>
            </div>
          </div>
          <div onClick={() => { playClickSound(); setIsPlaying(!isPlaying); }} className="relative flex-1 bg-black overflow-hidden cursor-pointer">
            <div className="absolute top-1/2 w-full h-1 bg-red-500/50 z-20 pointer-events-none flex items-center"><div className="w-4 h-4 rounded-full bg-red-500 -ml-2"></div><div className="w-full border-t border-dashed border-red-400/30"></div><div className="w-4 h-4 rounded-full bg-red-500 -mr-2"></div></div>
            <div ref={scrollerRef} className={`h-full w-full overflow-y-scroll no-scrollbar p-8 pb-[50vh] pt-[45vh] max-w-5xl mx-auto text-center font-bold tracking-wide leading-snug ${mirrorMode ? 'scale-x-[-1] rotate-180' : ''}`} style={{ fontSize: `${fontSize}px` }}>{renderPrompterText(text)}</div>
          </div>
        </div>
      )}

      {/* 🏷️ 固定水印 */}
      <div className="fixed bottom-4 right-4 z-40 pointer-events-none select-none opacity-80 mix-blend-multiply">
        <div className="bg-white/80 backdrop-blur-sm px-4 py-2 rounded-full border-2 border-gray-100 shadow-lg transform rotate-[-5deg] flex items-center gap-2">
          <span className="text-xl">🍚</span>
          <span className="font-black text-gray-700 tracking-widest text-lg" style={{ fontFamily: '"Comic Sans MS", cursive, sans-serif' }}>来碗AI</span>
        </div>
      </div>

      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .btn-tool { @apply flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors shadow-sm active:scale-95; } .btn-tool:hover { @apply shadow-md; }`}</style>
    </div>
  );
};

export default App;