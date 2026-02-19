const { app, BrowserWindow } = require('electron');
const path = require('path');

// 处理 Windows 安装时的创建快捷方式事件
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // 创建浏览器窗口
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "智能口播提词器",
    // 隐藏默认菜单栏（可选，看个人喜好）
    autoHideMenuBar: true, 
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // 简单配置，允许渲染进程使用 Node 能力（如果需要）
      // webSecurity: false // 如果遇到跨域图片问题可以临时开启，但不推荐
    },
  });

  // 判断环境：开发环境加载 URL，生产环境加载文件
  const isDev = !app.isPackaged;
  
  if (isDev) {
    // 等待 Vite 服务器启动，通常在 5173 端口
    mainWindow.loadURL('http://localhost:5173');
    // 开发模式打开控制台
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式加载打包后的 index.html
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});