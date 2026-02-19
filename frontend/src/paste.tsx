import { useState, useEffect, useRef, useCallback } from 'react';
import { Download, Play, Pause, RotateCcw, Type, Gauge, Monitor, X, Wand2, Star, GripVertical, PauseCircle, Loader2, CircleHelp, Volume2, Settings2, RefreshCw, AlertTriangle, Info, AlertCircle, ShoppingBag, GraduationCap, ChevronRight, Speaker, ArrowUpRight, ArrowDownRight, Mic, ShieldCheck, Eraser, Clock, Zap, Save, FileText, Sparkles, Code, Film } from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { setSubscriptionStatus, incrementCreditsUsed } from './store/subscriptionSlice';
import SubscriptionButton from './components/SubscriptionButton';
import UpgradeModal from './components/UpgradeModal';
import { initializePaddle } from '@paddle/paddle-js';

// 引入 Kling 相关功能
import { convertScriptToKling } from '../utils/mapToKling';

// --- 简单的音效生成器 ---
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
  } catch {
    // Ignore audio errors
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
              {type === 'confirm' ? <AlertTriangle size={24} /> : <Info size={24} />}
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
          {children}
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
6. 【发福袋】：用限时福利或资料包作为临门一脚。`
};
const App = () => {
  const dispatch = useDispatch();
  const subscription = useSelector((state: any) => state.subscription);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  // 模式选择: sales (卖货), course (卖课)
  const [aiMode, setAiMode] = useState('sales');
  // 自定义违禁词状态
  const [customBannedWords, setCustomBannedWords] = useState(localStorage.getItem('custom_banned_words') || '');
  const [showBannedSettings, setShowBannedSettings] = useState(false);
  // 自定义改写逻辑状态
  const [rewriteRules, setRewriteRules] = useState(() => {
    const saved = localStorage.getItem('rewrite_rules');
    const parsed = saved ? JSON.parse(saved) : {};
    return { ...DEFAULT_REWRITE_RULES, ...parsed };
  });
  const [showRewriteSettings, setShowRewriteSettings] = useState(false);
  const [editingConfigMode, setEditingConfigMode] = useState('sales');
  const [showLogicMenu, setShowLogicMenu] = useState(false);
  // 【新增】课程名/产品名状态
  const [courseTitle, setCourseTitle] = useState('');
  const [productTitle, setProductTitle] = useState('');
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
    aliyun: { name: '阿里云', desc: '自然度高' },
    volcengine: { name: '火山引擎', desc: '拟真度极高' },
    azure: { name: '微软 Azure', desc: '多语言强' }
  };
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 初始化：加载配置、语音、检查权限
  const loadSubscriptionStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/paddle/status');
      const data = await res.json();
      dispatch(setSubscriptionStatus(data));
    } catch (error) {
      console.error('加载订阅状态失败:', error);
    }
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

    initializePaddle({
      token: clientToken,
      environment: environment === 'sandbox' ? 'sandbox' : 'production',
      eventCallback: (event) => {
        console.log('Paddle Event:', event.name, event.data);

        if (event.name === 'checkout.completed') {
          loadSubscriptionStatus();
        }

        if (event.name === 'checkout.closed') {
          console.log('Checkout closed without payment');
        }
      }
    }).catch(error => {
      console.error('❌ Paddle 初始化失败:', error);
    });
  }, []);

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
  // 权限检查函数
  const checkPermission = async () => {
    if (subscription.isPro) return true;
    const success = await checkPermissionAndConsume();
    if (!success) {
      setShowUpgradeModal(true);
    }
    return success;
  };
  // 处理订阅 (用于 UpgradeModal)
  const handleSubscribe = async (planType) => {
    try {
      // 1. 调用后端获取 priceId 和 customerId
      const res = await fetch('/api/paddle/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType })
      });
      const data = await res.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      // 2. 用 Paddle.js 打开支付页面
      (window.Paddle as any).Checkout.open({
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
      console.error('订阅失败:', error);
      alert('订阅失败，请稍后重试');
    }
  };
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
    // 1. 加载订阅状态
    loadSubscriptionStatus();
    const timer = setInterval(loadSubscriptionStatus, 60000); // 每分钟刷新一次状态
    // 2. 加载浏览器语音
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
      clearInterval(timer);
      window.speechSynthesis.cancel();
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [selectedVoiceURI, loadSubscriptionStatus]);
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
  const generateDraft = (mode, topic) => {
    let draft = "";
    const productName = topic || (mode === 'sales' ? "这款产品" : "这门课程");
    if (mode === 'sales') {
      draft = `① 留人（约3秒） |
"所有人停一下！| 还在为买不到好用的${productName}发愁吗？看过来！↑" ||
② 价值（约15秒） |
"今天给大家带来的这款 *${productName}*，| 真的是我用过最好用的！| 它不仅外观时尚，| 而且功能超级强大，| 能完美解决你的痛点！*太绝了*！" ||
③ 比价（约10秒） |
"你去外面随便问，| 同样品质的${productName}，| 起码要卖到 *X99* 元！| 但是今天在我的直播间，| 我们直接源头工厂价，| 价格打到骨折！" ||
④ 保障（约10秒） |
"我们承诺 *七天无理由退换*，| 还有运费险，| 让你买得放心，| 用得安心！| 不满意包退！" ||
⑤ 稀缺（约5秒） |
"不过因为太火爆了，| 厂家只给了我们 50 单库存，| *手慢无*！| 抢到就是赚到！| 3，2，1，上链接！↓"`;
    } else {
      draft = `① 放钩子（约5秒） |
"想学${productName}的同学先别划走！| 只需要 3 天，| 带你从小白变大神！↑" ||
② 讲痛点（约15秒） |
"很多同学是不是觉得${productName}太难了？| 或者是学了很久不开窍？| 一看书就困？| 甚至想放弃？||"
③ 讲人设（约10秒） |
"别担心，| 我是深耕行业 10 年的 *XX老师*。| 我带过上万名学员，| 把最复杂的知识都总结成了口诀，| 像搭积木一样简单。" ||
④ 讲试题/干货（约20秒） |
"来，看这个核心知识点：| （这里插入${productName}的一个简单技巧或例题）。| 其实非常简单，| 只要掌握了这个逻辑，| 你也能轻松学会。||"
⑤ 讲进群（约10秒） |
"如果你想系统学习，| 现在点击下方链接或者打'进群'，| 我会把这套【${productName}思维导图】发在群里。||"
⑥ 发福袋（约10秒） |
"今天进群的同学，| 老师再额外送你一套价值 199 元的实战资料包！| 名额有限，| 抓紧时间上车！↓"`;
    }
    setText(draft);
    setTopicModal({ isOpen: false, mode: 'sales' });
    setTopicInput('');
  };
  // 处理模式点击：打开输入弹窗
  const handleModeClick = (mode) => {
    playClickSound();
    setAiMode(mode);
    setTopicModal({ isOpen: true, mode });
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
  // --- 1. AI 违禁词过滤 (需权限) ---
  const callContrabandCheck = async () => {
    playClickSound();
    // 权限校验
    if (!checkPermission()) return;
    if (!aiConfig.apiKey) {
      showMessage('未检测到 API Key，请联系管理员或在设置中配置自定义 Key。');
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
  // --- 2. AI 改写 (需权限) ---
  const callRewrite = async () => {
    playClickSound();
    // 权限校验
    if (!checkPermission()) return;
    if (!aiConfig.apiKey) {
      showMessage('未检测到 API Key，请联系管理员或在设置中配置自定义 Key。');
      return;
    }
    setIsAiLoading(true);
    setAiStatus('AI 正在改写文案...');
    // 使用当前模式的自定义规则
    const currentRule = rewriteRules[aiMode];
    // 【新增】根据模式获取标题
    const currentTitle = aiMode === 'sales' ? productTitle : courseTitle;
    let systemPrompt = "";
    if (aiMode === 'sales') {
      systemPrompt = `你是一位金牌带货主播文案专家。
请将用户的文稿改写为【卖货型】口播文案，严格遵循以下逻辑结构：
${currentRule}
产品名称：${currentTitle || '（未填写）'}
要求：口语化，情绪饱满，节奏紧凑。保持原意，但结构要符合上述逻辑。`;
    } else {
      // course mode
      systemPrompt = `你是一位知识付费领域的金牌销售文案专家。
请将用户的文稿改写为【卖课型】口播文案，严格遵循以下逻辑结构：
${currentRule}
课程名称：${currentTitle || '（未填写）'}
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
  // --- 3. AI 播感标注 (需权限) ---
  const callProsodyAnnotation = async () => {
    playClickSound();
    // 权限校验
    if (!checkPermission()) return;
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
  // 导出 JSON 文件
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
      console.log('[导出 JSON] 发送文本长度:', text.length);
      console.log('[导出 JSON] 文本预览:', text.substring(0, 200));
      // 调用后端接口
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
      // 接收 JSON 数据并触发下载
      const jsonData = await response.json();
      console.log('[导出 JSON] 后端返回:', {
        segmentCount: jsonData?.segments?.length,
        totalDuration: jsonData?.metadata?.total_duration_hint
      });
      const jsonStr = JSON.stringify(jsonData, null, 2);
      console.log('[导出 JSON] JSON 字符串长度:', jsonStr.length);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      // 生成文件名（包含时间戳，避免缓存）
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
      showMessage('导出成功！JSON 文件已下载。');
    } catch (error) {
      console.error('导出 JSON 失败:', error);
      showMessage('导出失败，请稍后重试。');
    } finally {
      setIsExportingJson(false);
    }
  };
  const handleExportKling = async () => {
    playClickSound();
    if (!text || text.trim().length === 0) {
      showMessage('请先输入台词内容');
      return;
    }
    setIsExportingKling(true);
    try {
      const response = await fetch('/api/export-kling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      });

      if (!response.ok) {
        throw new Error('导出失败');
      }

      const klingRequest = await response.json();

      const blob = new Blob([JSON.stringify(klingRequest, null, 2)], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `kling-request-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showMessage('导出成功！Kling 请求文件已下载。');
    } catch (error) {
      console.error('导出 Kling 请求失败:', error);
      showMessage('导出失败，请检查脚本格式');
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
    if (p === '||') return <span key={i} className="mx-1 text-red-500 font-bold text-lg align-middle">||</span>;
    if (p === '\n') return <br key={i} />;
    if (p === '↑') return <span key={i} className="mx-0.5 text-red-500 font-bold text-xl align-text-bottom" title="语调上扬">↗</span>;
    if (p === '↓') return <span key={i} className="mx-0.5 text-blue-500 font-bold text-xl align-text-top" title="语调下沉">↘</span>;
    if (p.startsWith('*')) return <span key={i} className="text-indigo-700 font-bold bg-indigo-50 px-1 rounded mx-0.5 border-b-2 border-indigo-200">{p.replace(/\*/g, '')}</span>;
    if (p.startsWith('【') && p.endsWith('】')) return <span key={i} className="text-red-600 font-black bg-red-100 px-1 rounded mx-0.5 border border-red-300 animate-pulse cursor-help" title="违禁词">{p}</span>;
    return <span key={i}>{p}</span>;
  });
  const renderPrompterText = (t) => t.split(/(\*.*?\*|\|+|\n|↑|↓|【.*?】|\(建议改为：.*?\))/g).map((p, i) => {
    if (p === '|') return <span key={i} className="inline-block w-4 h-4 mx-2 rounded-full bg-red-400/40 align-middle"></span>;
    if (p === '||') return <span key={i} className="inline-block w-8 h-8 mx-2 rounded-full bg-red-600 align-middle border-2 border-white/50"></span>;
    if (p === '\n') return <br key={i} />;
    if (p === '↑') return <span key={i} className="inline-block text-red-500 font-black text-[1.2em] align-top mx-1">↗</span>;
    if (p === '↓') return <span key={i} className="inline-block text-blue-400 font-black text-[1.2em] align-bottom mx-1">↘</span>;
    if (p.startsWith('【')) return <span key={i} className="text-red-400 bg-red-900/50 px-1 rounded border border-red-500 mx-1">{p}</span>;
    if (p.startsWith('(建议')) return <span key={i} className="text-green-400 text-[0.6em] mx-1 opacity-80">{p}</span>;
    if (p.startsWith('*')) return <span key={i} className="text-yellow-300 font-black text-[1.2em] drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)] mx-1 underline decoration-4 decoration-yellow-500">{p.replace(/\*/g, '')}</span>;
    return <span key={i}>{p}</span>;
  });
  const getVoiceName = (uri) => {
    const v = systemVoices.find(voice => voice.voiceURI === uri);
    return v ? `${v.name} (${v.lang})` : '默认语音';
  };
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 text-gray-700 font-sans selection:bg-indigo-200">
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
          <div className="bg-white rounded-[32px] shadow-2xl max-w-sm w-full p-8 border border-gray-100 flex flex-col items-center animate-in zoom-in-95 duration-200">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-sm ${topicModal.mode === 'sales' ? 'bg-indigo-100 text-indigo-600' : 'bg-blue-100 text-blue-600'}`}>
              {topicModal.mode === 'sales' ? <ShoppingBag size={32} /> : <GraduationCap size={32} />}
            </div>
            <h3 className="text-xl font-black text-gray-800 mb-2">
              {topicModal.mode === 'sales' ? '你要卖什么产品？' : '你要卖什么课程？'}
            </h3>
            <p className="text-sm text-gray-500 mb-6 text-center">
              AI 将根据您输入的主题，为您生成一套{topicModal.mode === 'sales' ? '高转化卖货' : '强吸引卖课'}口播话术。
            </p>
            <input
              type="text"
              autoFocus
              placeholder={topicModal.mode === 'sales' ? "例如：扫地机器人、美白面膜..." : "例如：Python编程、初中英语..."}
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
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-white shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${topicModal.mode === 'sales' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200'}`}
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
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-gray-100">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <ShieldCheck className="text-red-500" size={20} /> 自定义违禁词
              </h3>
              <button onClick={() => setShowBannedSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-2">输入您想屏蔽的词（如品牌名、竞品名等），用逗号、空格或换行分隔。系统在扫描时会自动将这些词高亮。</p>
            <textarea
              className="w-full h-32 p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-200 outline-none resize-none mb-4"
              placeholder="例如：第一, 最强, 竞品A, 绝对"
              value={customBannedWords}
              onChange={(e) => setCustomBannedWords(e.target.value)}
            />
            <button onClick={() => { playClickSound(); setShowBannedSettings(false); }} className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-200 flex items-center justify-center gap-2">
              <Save size={16} /> 保存设置
            </button>
          </div>
        </div>
      )}
      {/* AI改写规则设置弹窗 */}
      {showRewriteSettings && (
        <div className="fixed inset-0 z-[110] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-gray-100 flex flex-col max-h-[80vh]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
                <FileText className="text-emerald-500" size={24} />
                自定义{editingConfigMode === 'sales' ? '卖货' : '卖课'}逻辑
              </h3>
              <button onClick={() => setShowRewriteSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <p className="text-xs text-gray-500 mb-4 bg-emerald-50 p-3 rounded-xl border border-emerald-100 leading-relaxed">
              您可以在这里调整 AI 改写的逻辑框架。比如改变步骤顺序、增加新的环节或修改具体要求。AI 将严格按照您的设定生成文案。
            </p>
            {/* 【新增】产品名/课程名输入框 */}
            <div className="mb-3">
              <label className="block text-xs font-bold text-gray-600 mb-2">
                {editingConfigMode === 'sales' ? '产品名（必填）' : '课程名（必填）'}
              </label>
              <input
                type="text"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-200 outline-none transition-all"
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
            <textarea
              className="flex-1 min-h-[400px] w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-200 outline-none resize-none mb-4 font-mono leading-relaxed"
              value={rewriteRules[editingConfigMode]}
              onChange={(e) => setRewriteRules(prev => ({ ...prev, [editingConfigMode]: e.target.value }))}
            />
            <div className="flex gap-3">
              <button onClick={handleResetRewriteRules} className="px-4 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors flex items-center gap-2 text-xs">
                <RotateCcw size={14} /> 恢复默认
              </button>
              <button onClick={() => { playClickSound(); setShowRewriteSettings(false); }} className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-200 flex items-center justify-center gap-2">
                <Save size={16} /> 保存设置
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 升级弹窗 */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onSubscribe={handleSubscribe}
      />
      {/* 浏览器 TTS 设置弹窗 */}
      {showVoiceSettings && (
        <div className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl border-2 border-indigo-50">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-black flex items-center gap-2 text-gray-800">
                <Volume2 className="text-indigo-600" size={20} /> 浏览器朗读设置
              </h3>
              <button onClick={() => setShowVoiceSettings(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-6">
              {ttsError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl flex items-start gap-2 animate-in slide-in-from-top-2 shadow-sm">
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
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl appearance-none outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium"
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
                  <span className="text-indigo-600">{ttsRate}x</span>
                </label>
                <input
                  type="range" min="0.5" max="2.0" step="0.1"
                  value={ttsRate}
                  onChange={(e) => setTtsRate(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide flex justify-between">
                  <span>朗读音调</span>
                  <span className="text-indigo-600">{ttsPitch}</span>
                </label>
                <input
                  type="range" min="0.5" max="2.0" step="0.1"
                  value={ttsPitch}
                  onChange={(e) => setTtsPitch(parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div className="pt-2 border-t border-gray-100 flex justify-end">
                <button onClick={() => { playClickSound(); setShowVoiceSettings(false); setTtsError(''); }} className="px-6 py-2 bg-gray-900 text-white rounded-xl font-bold hover:bg-gray-800 transition-colors shadow-lg shadow-gray-200">
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
          <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
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
                  <button key={k} onClick={() => saveTtsConfig({ ...ttsConfig, provider: k })} className={`px-3 py-1.5 rounded-full text-sm font-bold border transition-all ${ttsConfig.provider === k ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                    {TTS_PROVIDERS[k].name}
                  </button>
                ))}
              </div>
            </div>
            {ttsConfig.provider === 'aliyun' && (
              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">AppKey</label>
                  <input type="password" value={ttsConfig.aliyun.appKey} onChange={e => saveTtsConfig({ ...ttsConfig, aliyun: { ...ttsConfig.aliyun, appKey: e.target.value } })} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" placeholder="输入 AppKey" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">AccessKey ID</label>
                  <input type="password" value={ttsConfig.aliyun.accessKeyId} onChange={e => saveTtsConfig({ ...ttsConfig, aliyun: { ...ttsConfig.aliyun, accessKeyId: e.target.value } })} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" placeholder="输入 AccessKey ID" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">AccessKey Secret</label>
                  <input type="password" value={ttsConfig.aliyun.accessKeySecret} onChange={e => saveTtsConfig({ ...ttsConfig, aliyun: { ...ttsConfig.aliyun, accessKeySecret: e.target.value } })} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" placeholder="输入 AccessKey Secret" />
                </div>
              </div>
            )}
            {ttsConfig.provider === 'volcengine' && (
              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">AppId</label>
                  <input type="text" value={ttsConfig.volcengine.appId} onChange={e => saveTtsConfig({ ...ttsConfig, volcengine: { ...ttsConfig.volcengine, appId: e.target.value } })} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" placeholder="输入 AppId" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Access Token</label>
                  <input type="password" value={ttsConfig.volcengine.accessToken} onChange={e => saveTtsConfig({ ...ttsConfig, volcengine: { ...ttsConfig.volcengine, accessToken: e.target.value } })} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" placeholder="输入 Access Token" />
                </div>
              </div>
            )}
            {ttsConfig.provider === 'azure' && (
              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Subscription Key</label>
                  <input type="password" value={ttsConfig.azure.key} onChange={e => saveTtsConfig({ ...ttsConfig, azure: { ...ttsConfig.azure, key: e.target.value } })} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" placeholder="输入 Subscription Key" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Region</label>
                  <input type="text" value={ttsConfig.azure.region} onChange={e => saveTtsConfig({ ...ttsConfig, azure: { ...ttsConfig.azure, region: e.target.value } })} className="w-full p-2 bg-white border border-gray-200 rounded-lg text-sm" placeholder="例如: eastus" />
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
            <div onClick={handleSecretClick} className="relative w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 cursor-pointer active:scale-90 transition-transform">
              <Monitor className="text-white" size={24} />
              {secretCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full text-[10px] flex items-center justify-center text-white font-bold animate-bounce">{8 - secretCount}</span>}
            </div>
            <div>
              <h1 className="text-3xl font-black text-gray-800 tracking-tight">智能口播提词器</h1>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-xs text-gray-400 font-medium ml-1">让你开口就像背熟稿 🚀</p>
                {/* 状态显示胶囊 */}
                {!subscription.isPro && (
                  <div className="flex gap-1.5 ml-2">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${subscription.trialEnd && new Date(subscription.trialEnd) < new Date() ? 'bg-red-50 text-red-500 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}>
                      <Clock size={10} /> {(() => {
                        if (!subscription.trialEnd) return '试用过期';
                        const daysLeft = Math.ceil(((new Date(subscription.trialEnd) as any) - (new Date() as any)) / (1000 * 60 * 60 * 24));
                        return daysLeft > 0 ? `${daysLeft}天` : '试用过期';
                      })()}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${subscription.dailyCreditsLimit - subscription.dailyCreditsUsed <= 0 ? 'bg-red-50 text-red-500 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                      <Zap size={10} /> 剩{subscription.dailyCreditsLimit - subscription.dailyCreditsUsed}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { playClickSound(); showMessage('使用规则：\n1. 点击【AI 违禁词过滤】识别极限词（支持点击设置按钮添加自定义词库）。\n2. 点击【AI 播感标注】自动添加停顿和重音。\n3. 点击【卖货型】或【卖课型】按钮后，输入具体产品名或课程名，即可自动生成文案。\n4. 点击【AI 改写】旁的设置按钮，会出现二级菜单，支持自定义卖货和卖课的话术逻辑。\n5. 普通用户试用 3 天，每天 10 点数。\n6. 开通会员可无限畅享所有功能。\n7. 导出 JSON 是为了后续制作短视频使用，方便把脚本导入到其他剪辑或自动化工具中。'); }} className="flex items-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-600 rounded-full font-bold hover:bg-gray-50 transition-colors shadow-sm active:scale-95">
              <CircleHelp size={18} /><span className="hidden md:inline">规则</span>
            </button>
            {/* 升级会员按钮 */}
            <SubscriptionButton
              subscription={subscription}
              onUpgrade={() => setShowUpgradeModal(true)}
            />
            {/* 试听按钮组 */}
            <div className="flex items-center bg-white border border-gray-200 rounded-full p-1 pl-1 pr-1 shadow-sm">
              <button
                onClick={handleSpeakToggle}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold transition-all active:scale-95 ${isReading ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-50 text-gray-600'}`}
              >
                {isReading ? <PauseCircle size={18} /> : <Speaker size={18} />}
                <span className="text-sm">{isReading ? '停止' : '试听'}</span>
              </button>
              <div className="w-px h-4 bg-gray-200 mx-1"></div>
              <button
                onClick={() => setShowVoiceSettings(true)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-50 transition-colors"
              >
                <Settings2 size={16} />
              </button>
            </div>
            <button onClick={() => { playClickSound(); setIsPrompterOpen(true); }} className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full font-bold shadow-lg shadow-indigo-200 transition-all hover:scale-105 active:scale-95">
              <Play size={20} fill="currentColor" /> 开始提词
            </button>
          </div>
        </header>
		  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(100vh-160px)]">
		          {/* 左侧编辑器 */}
		          <div className="flex flex-col bg-white rounded-[2rem] shadow-xl shadow-indigo-100/50 border border-indigo-100 overflow-hidden relative group">
		            {isAiLoading && <div className="absolute inset-0 z-20 bg-white/80 backdrop-blur-sm flex flex-col items-center justify-center text-indigo-500"><Loader2 size={40} className="animate-spin mb-2" /><p className="font-bold">{aiStatus}</p></div>}
		            {/* --- 工具栏 --- */}
		            <div className="bg-gradient-to-b from-white to-indigo-50/30 p-4 border-b border-indigo-100 space-y-4">
		              <div className="flex flex-wrap lg:flex-nowrap gap-4 items-center justify-between">
		                {/* 语气模板选择 */}
		                <div className="flex flex-col w-full lg:w-auto">
		                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 ml-1">内容生成 (Generate)</span>
		                  <div className="flex bg-gray-100 p-1 rounded-xl shrink-0">
		                    <button
		                      onClick={() => handleModeClick('sales')}
		                      className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${aiMode === 'sales' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
		                    >
		                      <ShoppingBag size={14} /> 卖货型
		                    </button>
		                    <button
		                      onClick={() => handleModeClick('course')}
		                      className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold transition-all ${aiMode === 'course' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
		                    >
		                      <GraduationCap size={14} /> 卖课型
		                    </button>
		                  </div>
		                </div>
		                {/* AI 动作按钮组 */}
		                <div className="flex flex-wrap gap-2 w-full lg:w-auto">
		                  {/* 违禁词过滤 + 设置组合按钮 */}
		                  <div className="flex-1 min-w-[100px] flex gap-0.5">
		                    <button
		                      onClick={callContrabandCheck}
		                      className="flex-grow flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-100 rounded-l-xl rounded-r-none shadow-sm font-bold transition-transform active:scale-95 hover:bg-red-100"
		                      title="AI 违禁词过滤 (消耗次数)"
		                    >
		                      <ShieldCheck size={16} /> <span className="text-xs">违禁词</span>
		                    </button>
		                    <button
		                      onClick={() => { playClickSound(); setShowBannedSettings(true); }}
		                      className="flex items-center justify-center px-2 bg-red-50 text-red-400 border border-l-0 border-red-100 rounded-r-xl hover:bg-red-100 transition-colors"
		                      title="添加自定义违禁词"
		                    >
		                      <Settings2 size={14} />
		                    </button>
		                  </div>
		                  {/* AI 改写 + 设置组合按钮 */}
		                  <div className="flex-1 min-w-[100px] flex gap-0.5 relative">
		                    <button
		                      onClick={callRewrite}
		                      className="flex-grow flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-l-xl rounded-r-none shadow-sm font-bold transition-transform active:scale-95 hover:bg-emerald-100"
		                      title="AI 智能改写 (消耗次数)"
		                    >
		                      <RefreshCw size={16} /> <span className="text-xs">AI 改写</span>
		                    </button>
		                    <button
		                      onClick={() => { playClickSound(); setShowLogicMenu(!showLogicMenu); }}
		                      className="flex items-center justify-center px-2 bg-emerald-50 text-emerald-400 border border-l-0 border-emerald-100 rounded-r-xl hover:bg-emerald-100 transition-colors"
		                      title="自定义改写逻辑"
		                    >
		                      <Settings2 size={14} />
		                    </button>
		                    {/* 改写逻辑二级菜单 */}
		                    {showLogicMenu && (
		                      <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
		                        <button onClick={() => openRewriteSettings('sales')} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center gap-2">
		                          <ShoppingBag size={14} /> 自定义卖货逻辑
		                        </button>
		                        <div className="h-[1px] bg-gray-100"></div>
		                        <button onClick={() => openRewriteSettings('course')} className="w-full text-left px-4 py-3 text-xs font-bold text-gray-600 hover:bg-emerald-50 hover:text-emerald-600 transition-colors flex items-center gap-2">
		                          <GraduationCap size={14} /> 自定义卖课逻辑
		                        </button>
		                      </div>
		                    )}
		                  </div>
		                  <button
		                    onClick={callProsodyAnnotation}
		                    className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 text-white rounded-xl shadow-md shadow-indigo-200 font-bold transition-transform active:scale-95 hover:bg-indigo-700"
		                    title="AI 播感标注 (消耗次数)"
		                  >
		                    <Wand2 size={16} /> <span className="text-xs">AI 播感标注</span>
		                  </button>
		                </div>
		              </div>
		              {/* 手动微调工具栏 */}
		              <div className="flex items-center gap-2 pt-2 border-t border-indigo-100/50 overflow-x-auto no-scrollbar">
		                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0 mr-1">手动标记</span>
		                <button onClick={() => insertMark('stress')} className="btn-tool text-yellow-600 bg-yellow-50 hover:bg-yellow-100"><Star size={14} fill="currentColor" /> 重点</button>
		                <button onClick={() => insertMark('short')} className="btn-tool text-gray-600 bg-gray-100 hover:bg-gray-200"><GripVertical size={14} /> 短停 |</button>
		                <button onClick={() => insertMark('long')} className="btn-tool text-red-600 bg-red-50 hover:bg-red-100"><PauseCircle size={14} /> 长停 ||</button>
		                <button onClick={() => insertMark('up')} className="btn-tool text-red-600 bg-red-50 hover:bg-red-100"><ArrowUpRight size={14} /> 上扬 ↑</button>
		                <button onClick={() => insertMark('down')} className="btn-tool text-blue-600 bg-blue-50 hover:bg-blue-100"><ArrowDownRight size={14} /> 收尾 ↓</button>
		                <div className="flex-1"></div>
		                <button onClick={clearMarks} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="清除所有标记"><Eraser size={14} /></button>
		              </div>
		            </div>
		            <textarea ref={textareaRef} className="flex-1 w-full p-6 bg-transparent outline-none resize-none font-sans text-lg leading-relaxed text-gray-600 placeholder-gray-300" value={text} onChange={e => setText(e.target.value)} placeholder="在此粘贴你的文稿，让 AI 帮你找感觉~" />
		            {/* 底部播放状态指示 */}
		            {isReading && (
		              <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-indigo-100 p-3 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] animate-in slide-in-from-bottom-10 flex items-center gap-3">
		                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center animate-pulse">
		                  <Mic size={20} />
		                </div>
		                <div className="flex-1">
		                  <div className="font-bold text-sm text-gray-800">正在朗读中...</div>
		                  <div className="text-xs text-gray-500 truncate w-64">{getVoiceName(selectedVoiceURI)}</div>
		                </div>
		                <button
		                  onClick={handleSpeakToggle}
		                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-bold transition-colors"
		                >
		                  停止
		                </button>
		              </div>
		            )}
		          </div>
		          {/* 右侧预览 */}
		          <div className="flex flex-col bg-white rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
		            <div className="bg-gradient-to-r from-slate-50 to-gray-50 p-4 border-b border-slate-200 flex items-center justify-between">
		              <div className="flex items-center gap-3">
		                <button
		                  onClick={handleExportWord}
		                  disabled={isExportingWord || !text || text.trim().length === 0}
		                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 ${
		                    isExportingWord || !text || text.trim().length === 0
		                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
		                      : 'bg-white text-emerald-600 border border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300 hover:shadow-md'
		                  }`}
		                  title="导出为 Word 文档"
		                >
		                  {isExportingWord ? (
		                    <Loader2 size={14} className="animate-spin" />
		                  ) : (
		                    <FileText size={14} />
		                  )}
		                  <span className="hidden sm:inline">导出 Word</span>
		                </button>
		                <button
		                  onClick={handleExportJson}
		                  disabled={isExportingJson || !text || text.trim().length === 0}
		                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 ${
		                    isExportingJson || !text || text.trim().length === 0
		                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
		                      : 'bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 hover:shadow-md'
		                  }`}
		                  title="导出为结构化 JSON，支持对接视频 API"
		                >
		                  {isExportingJson ? (
		                    <Loader2 size={14} className="animate-spin" />
		                  ) : (
		                    <Code size={14} />
		                  )}
                  <span className="hidden sm:inline">导出 JSON</span>
                </button>
                <button
                  onClick={handleExportKling}
                  disabled={isExportingKling || !text || text.trim().length === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition-all shadow-sm active:scale-95 border-2 border-red-500 ${
                    isExportingKling || !text || text.trim().length === 0
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700 hover:shadow-md'
                  }`}
                  title="导出为 Kling AI multi-shot 视频生成请求"
                >
                  {isExportingKling ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Film size={14} />
                  )}
                  <span className="hidden sm:inline">导出 Kling</span>
                </button>
                <div className="flex items-center gap-2 text-slate-600 font-bold"><Monitor size={18} /> 效果预览</div>
		              </div>
		              <div className="text-xs bg-white text-slate-400 px-3 py-1 rounded-full font-bold shadow-sm">Preview</div>
		            </div>
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
		              <button onClick={() => { playClickSound(); setIsPlaying(!isPlaying); }} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} shadow-lg`}>
		                {isPlaying ? <Pause fill="currentColor" size={24} /> : <Play fill="currentColor" className="ml-1" size={24} />}
		              </button>
		              <button onClick={() => { playClickSound(); if (scrollerRef.current) scrollerRef.current.scrollTop = 0; setIsPlaying(false); }} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full"><RotateCcw size={20} /></button>
		            </div>
		            <div className="hidden md:flex gap-6 items-center">
		              <div className="flex items-center gap-2"><Type size={16} /><input type="range" min="30" max="150" value={fontSize} onChange={e => setFontSize(Number(e.target.value))} className="accent-indigo-500 h-2 bg-gray-600 rounded-lg appearance-none" /></div>
		              <div className="flex items-center gap-2"><Gauge size={16} /><input type="range" min="1" max="10" step="0.5" value={scrollSpeed} onChange={e => setScrollSpeed(Number(e.target.value))} className="accent-indigo-500 h-2 bg-gray-600 rounded-lg appearance-none" /></div>
		              <button onClick={() => { playClickSound(); setMirrorMode(!mirrorMode); }} className={`px-3 py-1 rounded-lg text-xs font-bold border ${mirrorMode ? 'bg-indigo-600 border-indigo-600' : 'border-gray-500'}`}>MIRROR</button>
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
		      <style>{`.no-scrollbar::-webkit-scrollbar { display: none; } .btn-tool { @apply flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs transition-colors shadow-sm active:scale-95; }`}</style>
		    </div>
		  );
		};
		export default App;
