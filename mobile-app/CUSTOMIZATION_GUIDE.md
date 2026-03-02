# ShareBooster Mobile - Customization Guide

## Branding Customization

### 1. Change App Name

**File:** `capacitor.config.json`
```json
{
  "appName": "Your App Name"
}
```

After changing, run:
```bash
npm run android:sync
```

### 2. Change Package Name (App ID)

**File:** `capacitor.config.json`
```json
{
  "appId": "com.yourcompany.yourapp"
}
```

**Important:** This should be done BEFORE adding Android platform. If you already added it:
```bash
# Remove android folder
rm -rf android
# Re-add with new appId
npm run android:add
```

### 3. Change App Icon

#### Option A: Quick Icon Change

Replace these files in `android/app/src/main/res/`:
- `mipmap-hdpi/ic_launcher.png` (72x72)
- `mipmap-mdpi/ic_launcher.png` (48x48)
- `mipmap-xhdpi/ic_launcher.png` (96x96)
- `mipmap-xxhdpi/ic_launcher.png` (144x144)
- `mipmap-xxxhdpi/ic_launcher.png` (192x192)

#### Option B: Using Online Tool

1. Visit https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html
2. Upload your icon (512x512 recommended)
3. Customize shape, padding, background
4. Download and replace in `android/app/src/main/res/mipmap-*`

### 4. Change Splash Screen

#### Update Splash Screen Color

**File:** `capacitor.config.json`
```json
{
  "plugins": {
    "SplashScreen": {
      "backgroundColor": "#YOUR_COLOR"
    }
  }
}
```

#### Update Splash Screen Image

Replace: `android/app/src/main/res/drawable/splash.png`

Recommended size: 2732x2732 (centered logo, transparent background)

#### Customize Splash Duration

**File:** `capacitor.config.json`
```json
{
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 3000
    }
  }
}
```

### 5. Change Color Scheme

**File:** `src/views/Splash.vue` (and other .vue files)

Main purple gradient colors:
```css
/* Primary color */
#7C3AED → Your color

/* Secondary color */
#5B21B6 → Your color
```

Global search and replace:
```bash
# Find all instances of primary color
grep -r "#7C3AED" src/

# Replace with your color
sed -i 's/#7C3AED/#YOUR_COLOR/g' src/**/*.vue
```

### 6. Change Status Bar

**File:** `capacitor.config.json`
```json
{
  "plugins": {
    "StatusBar": {
      "style": "dark",  // or "light"
      "backgroundColor": "#YOUR_COLOR"
    }
  }
}
```

## Feature Customization

### 1. Change Share Limits

**File:** `src/views/Home.vue` and `src/views/Share.vue`

```javascript
shareLimit() {
  return this.isPremium ? 4000 : 500;  // Change these numbers
}
```

### 2. Modify Navigation

**File:** `src/router/index.js`

Add new routes:
```javascript
{
  path: '/your-page',
  name: 'YourPage',
  component: () => import('../views/YourPage.vue'),
  meta: { requiresAuth: true }
}
```

Remove routes by deleting the route object.

### 3. Change API Endpoint

**File:** `.env`
```bash
VITE_API_URL=https://your-api-url.com
```

Or for multiple environments:
- `.env.development` - Development API
- `.env.production` - Production API
- `.env.staging` - Staging API

### 4. Disable Features

To disable premium features:

**File:** `src/views/Home.vue`
```vue
<!-- Remove or comment out -->
<button @click="$router.push('/premium')" class="action-btn" v-if="false">
  <span class="icon">⭐</span>
  <span>Go Premium</span>
</button>
```

To remove entire screens, delete from:
1. `src/views/ScreenName.vue`
2. `src/router/index.js` (remove route)

## Advanced Customization

### 1. Add Custom Fonts

1. Add font files to `src/assets/fonts/`
2. Update `index.html`:
```html
<style>
@font-face {
  font-family: 'YourFont';
  src: url('/src/assets/fonts/YourFont.woff2');
}
body {
  font-family: 'YourFont', sans-serif;
}
</style>
```

### 2. Add Dark Mode

**File:** `src/App.vue`
```javascript
data() {
  return {
    darkMode: false
  }
},
mounted() {
  this.darkMode = localStorage.getItem('darkMode') === 'true';
  this.applyTheme();
},
methods: {
  toggleDarkMode() {
    this.darkMode = !this.darkMode;
    localStorage.setItem('darkMode', this.darkMode);
    this.applyTheme();
  },
  applyTheme() {
    document.body.classList.toggle('dark', this.darkMode);
  }
}
```

### 3. Add Push Notifications

**File:** `src/main.js`
```javascript
import { PushNotifications } from '@capacitor/push-notifications';

// Request permission
await PushNotifications.requestPermissions();

// Register for push
await PushNotifications.register();

// Listen for registration
PushNotifications.addListener('registration', (token) => {
  console.log('Push token:', token.value);
  // Send to your backend
});

// Listen for notifications
PushNotifications.addListener('pushNotificationReceived', (notification) => {
  console.log('Notification:', notification);
});
```

### 4. Add Analytics

Install analytics SDK:
```bash
npm install @capacitor-community/firebase-analytics
```

Configure and use:
```javascript
import { FirebaseAnalytics } from '@capacitor-community/firebase-analytics';

// Log events
await FirebaseAnalytics.logEvent({
  name: 'share_started',
  params: {
    amount: 100
  }
});
```

### 5. Add Biometric Authentication

Install plugin:
```bash
npm install @aparajita/capacitor-biometric-auth
```

Use in login:
```javascript
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';

async authenticateWithBiometric() {
  const result = await BiometricAuth.authenticate({
    reason: 'Please authenticate to login'
  });
  if (result.success) {
    // Proceed with login
  }
}
```

## Build Customization

### 1. Reduce APK Size

**File:** `android/app/build.gradle`
```gradle
android {
  buildTypes {
    release {
      minifyEnabled true
      shrinkResources true
      proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
  }
}
```

### 2. Enable ABI Split

**File:** `android/app/build.gradle`
```gradle
android {
  splits {
    abi {
      enable true
      reset()
      include 'arm64-v8a', 'armeabi-v7a'
      universalApk false
    }
  }
}
```

### 3. Change Minimum Android Version

**File:** `android/app/build.gradle`
```gradle
android {
  defaultConfig {
    minSdkVersion 21  // Change this (21 = Android 5.0)
  }
}
```

### 4. Add Version Code

**File:** `android/app/build.gradle`
```gradle
android {
  defaultConfig {
    versionCode 1      // Increment for each release
    versionName "1.0.0" // User-visible version
  }
}
```

## Permissions Customization

**File:** `android/app/src/main/AndroidManifest.xml`

Add permissions:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
```

Remove permissions by deleting the line.

## Testing Customizations

After making changes:

1. **Web changes:** `npm run build`
2. **Native changes:** `npm run android:sync`
3. **Config changes:** Rebuild APK
4. **Test:** Install and verify on device

## Rollback Changes

If something breaks:

```bash
# Restore from git
git checkout src/views/YourChangedFile.vue

# Or rebuild from scratch
rm -rf android dist node_modules
npm install
npm run build
npm run android:add
```

## Best Practices

1. **Test on real devices** after customizations
2. **Keep backups** of working versions
3. **Use version control** (git) for all changes
4. **Document your changes** in comments
5. **Test thoroughly** before distributing

## Resources

- [Capacitor Plugins](https://capacitorjs.com/docs/plugins)
- [Vue Components](https://vuejs.org/guide/components/registration.html)
- [Android Styling](https://developer.android.com/guide/topics/ui/look-and-feel/themes)
- [Material Colors](https://materialui.co/colors)

---

Need help with specific customizations? Check the documentation or create an issue!
