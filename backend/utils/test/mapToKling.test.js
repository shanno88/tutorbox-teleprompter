/**
 * 测试 Kling JSON 映射功能
 */

import { convertScriptToKling } from '../mapToKling.js';

// 测试用的脚本 JSON（来自 parseScriptText 函数输出）
const testScriptJson = {
  title: "智能口播提词稿",
  version: "1.0",
  created_at: new Date().toISOString(),
  exported_by: "ai-teleprompter",
  metadata: {
    total_duration_hint: 70,
    segment_count: 6,
    language: "zh-CN"
  },
  segments: [
    {
      id: "s1",
      role: "narrator",
      section: "① 放钩子（约5秒）",
      duration_hint: 5,
      raw_text: "想学法语的同学先别划走！只需要 3 天，带你从小白变大神！",
      marks: [
        { type: "short_pause", position: 9 },
        { type: "rise", position: 22 }
      ]
    },
    {
      id: "s2",
      role: "narrator",
      section: "② 讲痛点（约15秒）",
      duration_hint: 15,
      raw_text: "很多同学是不是觉得法语太难了？或者是学了很久不开窍？",
      marks: [
        { type: "short_pause", position: 10 },
        { type: "short_pause", position: 27 },
        { type: "long_pause", position: 38 }
      ]
    },
    {
      id: "s3",
      role: "narrator",
      section: "③ 讲人设（约10秒）",
      duration_hint: 10,
      raw_text: "别担心，我是深耕行业 10 年的 XX 老师。",
      marks: [
        { type: "short_pause", position: 8 },
        { type: "short_pause", position: 19 }
      ]
    },
    {
      id: "s4",
      role: "narrator",
      section: "④ 讲试题/干货（约20秒）",
      duration_hint: 20,
      raw_text: "来，看这个核心知识点：其实非常简单，只要掌握了这个逻辑，你也能轻松学会。",
      marks: [
        { type: "short_pause", position: 5 },
        { type: "short_pause", position: 13 },
        { type: "short_pause", position: 21 }
      ]
    },
    {
      id: "s5",
      role: "narrator",
      section: "⑤ 讲进群（约10秒）",
      duration_hint: 10,
      raw_text: "如果你想系统学习，现在点击下方链接或者打'进群'，我会把这套【法语思维导图】发在群里。",
      marks: [
        { type: "short_pause", position: 7 },
        { type: "short_pause", position: 21 },
        { type: "long_pause", position: 32 }
      ]
    },
    {
      id: "6",
      role: "narrator",
      section: "⑥ 发福袋（约10秒）",
      duration_hint: 10,
      raw_text: "今天进群的同学，老师再额外送你一套价值 199 元的实战资料包！",
      marks: [
        { type: "short_pause", position: 8 },
        { type: "short_pause", position: 19 },
        { type: "short_pause", position: 29 },
        { type: "fall", position: 38 }
      ]
    }
  ]
};

// 测试转换
console.log('=== Kling JSON 转换测试 ===\n');

console.log('原始 JSON:');
console.log(JSON.stringify(testScriptJson, null, 2));

console.log('\n转换后的 Kling 请求:');
const klingRequest = convertScriptToKling(testScriptJson);
console.log(JSON.stringify(klingRequest, null, 2));

console.log('\n=== 验证结果 ===\n');

// 验证 shots 数量
console.log('Shots 数量:', klingRequest.shots.length);

// 验证每个 shot 的必填字段
klingRequest.shots.forEach((shot, index) => {
  console.log(`\nShot ${index + 1} 验证:`);
  console.log('- shot_id:', shot.shot_id);
  console.log('- prompt length:', shot.prompt.length);
  console.log('- duration:', shot.duration);
  console.log('- camera_movement:', shot.camera_movement);
  console.log('- scene_role:', klingRequest.scene_role);
  console.log('- camera_hint:', klingRequest.camera_hint);
  console.log('- shots 数量:', klingRequest.shots.length);
});

// 验证整体结构
console.log('\n=== 整体结构验证 ===\n');
console.log('model:', klingRequest.model);
console.log('mode:', klingRequest.mode);
console.log('duration:', klingRequest.duration);
console.log('aspect_ratio:', klingRequest.aspect_ratio);
console.log('style:', klingRequest.style);

// 验证映射逻辑
console.log('\n=== Section → Scene Role 映射验证 ===\n');
testScriptJson.segments.forEach((segment, index) => {
  const sceneRole = klingRequest.shots[index].scene_role;
  console.log(`Segment ${index + 1} (${segment.section}) → Scene Role: ${sceneRole}`);
});
