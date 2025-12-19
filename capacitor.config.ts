import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.magicray.app',
  appName: 'work',
  webDir: 'www',
  server: {
    androidScheme: 'http',  // 从https改为http，避免本地资源访问问题
    allowNavigation: ['localhost']  // 允许本地导航
  }

};

export default config;
