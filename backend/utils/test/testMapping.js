import { convertScriptToKling } from '../mapToKling.js';

// 测试数据：一个简单的 5 段卖货脚本
const testScript = {
  title: "智能口播提词稿",
  version: "1.0",
  metadata: {
    total_duration_hint: 37,
    segment_count: 5,
    language: "zh-CN"
  },
  segments: [
    {
      id: "s1",
      section: "① 留人（约3秒）",
      duration_hint: 5,
      raw_text: "所有人停一下！还在为买不到好用的电脑发愁吗？看过来！"
    },
    {
      id: "s2",
      section: "② 价值（约15秒）",
      duration_hint: 10,
      raw_text: "今天给大家带来的这款电脑，真的是我用过最好用的！它不仅外观时尚，而且功能超级强大！"
    },
    {
      id: "s3",
      section: "③ 比价（约10秒）",
      duration_hint: 9,
      raw_text: "你去外面随便问，同样品质的电脑，起码要卖到X99元！但是今天在我的直播间，价格打到骨折！"
    },
    {
      id: "s4",
      section: "④ 保障（约10秒）",
      duration_hint: 7,
      raw_text: "我们承诺七天无理由退换，还有运费险，让你买得放心！"
    },
    {
      id: "s5",
      section: "⑤ 稀缺（约5秒）",
      duration_hint: 6,
      raw_text: "不过因为太火爆了，厂家只给了我们50单库存，手慢无！3，2，1，上链接！"
    }
  ]
};

console.log('🧪 测试播感 JSON → Kling 请求转换\n');
console.log('输入：', testScript.title);
console.log('段落数：', testScript.segments.length);
console.log('\n开始转换...\n');

try {
  const klingRequest = convertScriptToKling(testScript);
  
  console.log('✅ 转换成功！\n');
  console.log('Kling 请求体：');
  console.log(JSON.stringify(klingRequest, null, 2));
  
  console.log('\n📊 生成的 shots：');
  klingRequest.shots.forEach((shot, i) => {
    console.log(`\n${i + 1}. ${shot.shot_id}`);
    console.log(`   时长: ${shot.duration}s`);
    console.log(`   Prompt: ${shot.prompt.substring(0, 60)}...`);
  });
  
} catch (error) {
  console.error('❌ 转换失败：', error.message);
  console.error(error.stack);
}