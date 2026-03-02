import { createApp } from 'vue';
import App from './App.vue';
import router from './router';
import { SplashScreen } from '@capacitor/splash-screen';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Keyboard } from '@capacitor/keyboard';

const app = createApp(App);
app.use(router);
app.mount('#app');

document.addEventListener('deviceready', async () => {
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#7C3AED' });
  } catch (e) {
    console.log('StatusBar not available');
  }

  try {
    await SplashScreen.hide();
  } catch (e) {
    console.log('SplashScreen not available');
  }

  try {
    Keyboard.setAccessoryBarVisible({ isVisible: false });
  } catch (e) {
    console.log('Keyboard not available');
  }
});
