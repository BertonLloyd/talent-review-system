import type { Config } from 'tailwindcss';

/**
 * Tailwind v4 兼容配置（被 client/src/index.css 的 @config 引用）。
 * 主题色板与插件以 CSS 为准：tailwind-theme.css（@theme）、typography.css（@plugin）。
 * 此处仅声明扫描范围与暗色模式，避免 JS 配置与 CSS 主题重复维护。
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './client/index.html',
    './client/src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
