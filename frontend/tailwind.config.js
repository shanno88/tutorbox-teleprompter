/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // 如果你的代码中使用了自定义动画（如 animate-in, zoom-in-95），
      // 需要在这里添加 tailwindcss-animate 插件或手动定义 keyframes。
      // 下面是为了兼容你现有代码中使用的原生类名动画
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        zoomIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        }
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'zoom-in-95': 'zoomIn 0.2s ease-out',
      }
    },
  },
  plugins: [],
}