// 测试 JSON 导出功能

const testContent = `① 留人（约3秒）
"[所有人]停一下！ [短停] 还在为买不到[好用]的机器人发愁吗 [上扬]？[看过来] [收尾]！"

② 价值（约15秒）
"今天给大家带来的这款 [短停] [机器人]， [短停] 真的是我[用过最好用]的 [收尾]！ [短停] 它不仅[外观时尚]， [短停] 而且功能[超级强大]， [短停] 能[完美]解决你的[痛点] [收尾]！[太绝了] [收尾]！"
`;

fetch('http://localhost:3001/api/export-json', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    content: testContent,
    title: '测试稿件'
  }),
})
  .then(response => response.json())
  .then(data => {
    console.log('JSON 导出结果：');
    console.log(JSON.stringify(data, null, 2));
  })
  .catch(error => {
    console.error('测试失败：', error);
  });
