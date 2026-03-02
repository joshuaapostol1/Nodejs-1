# ShareBooster Android APK Build Instructions

This guide will walk you through building the ShareBooster Android APK from source.

## Prerequisites

Before you begin, ensure you have the following installed:

1. **Node.js** (v18 or higher)
   ```bash
   node --version
   ```

2. **Java Development Kit (JDK)** version 17
   ```bash
   java -version
   ```
   Download from: https://www.oracle.com/java/technologies/downloads/#java17

3. **Android Studio** (Latest version)
   - Download from: https://developer.android.com/studio
   - During installation, ensure you install:
     - Android SDK
     - Android SDK Platform
     - Android Virtual Device (optional, for testing)

4. **Gradle** (Usually comes with Android Studio)

## Environment Setup

### 1. Set up Android Environment Variables

Add these to your system environment variables:

**Windows:**
```bash
ANDROID_HOME=C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk
Path=%Path%;%ANDROID_HOME%\platform-tools;%ANDROID_HOME%\tools
```

**macOS/Linux:**
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
```

### 2. Verify Android SDK Installation

```bash
sdkmanager --version
```

## Building the APK

### Step 1: Install Dependencies

Navigate to the mobile-app directory and install dependencies:

```bash
cd mobile-app
npm install
```

### Step 2: Configure API URL

Create a `.env` file in the `mobile-app` directory:

```bash
VITE_API_URL=https://sharebooster.sbs
```

Or use your local backend URL during development:

```bash
VITE_API_URL=http://your-local-ip:5000
```

**Important:** Do NOT use `localhost` or `127.0.0.1` as the Android device cannot reach your local machine. Use your computer's local IP address (e.g., `192.168.1.100:5000`).

### Step 3: Build the Web App

```bash
npm run build
```

This creates the `dist` folder with your compiled web application.

### Step 4: Add Android Platform

```bash
npm run android:add
```

This creates the `android` folder with the native Android project.

### Step 5: Sync Capacitor

```bash
npm run android:sync
```

This copies your web app files to the Android project.

### Step 6: Build the APK

You have two options:

#### Option A: Build Debug APK (for testing)

```bash
npm run android:build:debug
```

The APK will be located at:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

#### Option B: Build Release APK (for production)

First, create a keystore for signing:

```bash
cd android
keytool -genkey -v -keystore sharebooster-release-key.jks -alias sharebooster -keyalg RSA -keysize 2048 -validity 10000
```

Follow the prompts to create your keystore. **REMEMBER YOUR PASSWORDS!**

Create `android/key.properties`:

```properties
storePassword=YOUR_KEYSTORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=sharebooster
storeFile=sharebooster-release-key.jks
```

Then build the release APK:

```bash
npm run android:build
```

The signed APK will be located at:
```
android/app/build/outputs/apk/release/app-release.apk
```

### Step 7: Install APK on Device

Transfer the APK to your Android device and install it. Or use ADB:

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Customizing the App

### Change App Name

Edit `capacitor.config.json`:
```json
{
  "appName": "Your App Name"
}
```

### Change App Icon

Replace the icon files in:
- `android/app/src/main/res/mipmap-*/ic_launcher.png`

Or use a tool like: https://romannurik.github.io/AndroidAssetStudio/icons-launcher.html

### Change App ID

Edit `capacitor.config.json`:
```json
{
  "appId": "com.yourcompany.yourapp"
}
```

### Change Splash Screen

Replace:
- `android/app/src/main/res/drawable/splash.png`

## Testing During Development

### Open in Android Studio

```bash
npm run android:open
```

This opens the project in Android Studio where you can:
- Run the app on an emulator
- Debug the app
- Build and sign APKs
- Test on physical devices

### Live Reload Development

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Update `capacitor.config.json` to point to your dev server:
   ```json
   {
     "server": {
       "url": "http://YOUR_LOCAL_IP:3000",
       "cleartext": true
     }
   }
   ```

3. Sync and run:
   ```bash
   npm run android:sync
   npm run android:open
   ```

## Troubleshooting

### "Command failed: gradlew assembleRelease"

- Ensure JDK 17 is installed
- Check JAVA_HOME environment variable
- Run `./gradlew clean` in the android directory

### "SDK location not found"

Create `android/local.properties`:
```properties
sdk.dir=C:\\Users\\YOUR_USERNAME\\AppData\\Local\\Android\\Sdk
```

(Use forward slashes on macOS/Linux)

### "Cleartext HTTP traffic not permitted"

Add to `android/app/src/main/AndroidManifest.xml`:
```xml
<application
    android:usesCleartextTraffic="true"
    ...>
```

### App crashes on startup

Check Android logcat:
```bash
adb logcat | grep -i sharebooster
```

## Build Variants

### Debug Build
- Unsigned or debug-signed
- Includes debugging information
- Larger file size
- Use for testing only

### Release Build
- Signed with your release key
- Optimized and minified
- Smaller file size
- Ready for distribution

## Distribution

### Google Play Store

1. Create a Google Play Developer account
2. Create a new app listing
3. Upload the signed release APK
4. Complete store listing requirements
5. Submit for review

### Direct Distribution

Simply share the APK file. Users must:
1. Enable "Install from Unknown Sources" in Android settings
2. Download and open the APK
3. Follow installation prompts

## Additional Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Android Developer Guide](https://developer.android.com/guide)
- [Vue.js Documentation](https://vuejs.org/guide/introduction.html)

## Support

For issues or questions:
- Check the [Capacitor Community](https://github.com/ionic-team/capacitor/discussions)
- Review Android Studio build logs
- Check your backend API connectivity

## Security Notes

1. **Never commit your keystore files** to version control
2. **Keep your keystore passwords secure** - if you lose them, you cannot update your app
3. **Use HTTPS** for your production API
4. **Validate all user inputs** on both client and server
5. **Store sensitive data securely** using Android Keystore

## Performance Optimization

1. **Enable Proguard** for release builds (reduces APK size)
2. **Optimize images** before including them
3. **Use lazy loading** for routes
4. **Minimize API calls** where possible
5. **Cache data** appropriately

## App Size Optimization

Current APK size: ~8-15 MB (varies with assets)

To reduce size:
1. Remove unused dependencies
2. Optimize images and assets
3. Enable Proguard/R8 shrinking
4. Use WebP for images
5. Split APKs by ABI (arm64, x86, etc.)

---

**Happy Building! 🚀**
