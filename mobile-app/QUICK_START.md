# ShareBooster Mobile - Quick Start Guide

## Fastest Way to Build Your APK

### Option 1: Using NPM Scripts (Recommended)

```bash
# 1. Navigate to mobile-app directory
cd mobile-app

# 2. Install dependencies
npm install

# 3. Create .env file
echo "VITE_API_URL=https://sharebooster.sbs" > .env

# 4. Build web app
npm run build

# 5. Add Android platform (first time only)
npm run android:add

# 6. Build debug APK
npm run android:build:debug
```

Your APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Option 2: Using Android Studio

```bash
# Steps 1-5 same as above

# 6. Open in Android Studio
npm run android:open

# 7. In Android Studio:
#    - Wait for Gradle sync to complete
#    - Go to Build > Build Bundle(s) / APK(s) > Build APK(s)
#    - Find APK in android/app/build/outputs/apk/
```

## Prerequisites Check

Before starting, verify you have:

```bash
# Node.js (should be v18+)
node --version

# Java (should be JDK 17)
java -version

# Android SDK (check if sdkmanager is available)
sdkmanager --version
```

If any are missing, see BUILD_INSTRUCTIONS.md for installation guides.

## Common Issues & Quick Fixes

### Issue: "ANDROID_HOME is not set"

**Fix:**
```bash
# Windows
set ANDROID_HOME=C:\Users\YOUR_USERNAME\AppData\Local\Android\Sdk

# macOS/Linux
export ANDROID_HOME=$HOME/Android/Sdk
```

### Issue: "Command gradlew not found"

**Fix:** Make sure you ran `npm run android:add` first

### Issue: "Java version incompatible"

**Fix:** Install JDK 17 from https://www.oracle.com/java/technologies/downloads/#java17

### Issue: "Build failed with exception"

**Fix:**
```bash
cd android
./gradlew clean
cd ..
npm run android:build:debug
```

## Testing Your APK

### Install on Android Device

1. Enable "Developer Options" on your Android phone
2. Enable "USB Debugging"
3. Connect phone via USB
4. Run:
   ```bash
   adb devices  # Verify device is connected
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Or Share APK File

Simply copy the APK file to your phone and install it. You may need to allow installation from unknown sources.

## What's Next?

After building successfully:

1. **Test the app** on a real device or emulator
2. **Customize branding** (app name, icon, splash screen)
3. **Build release APK** for distribution (see BUILD_INSTRUCTIONS.md)
4. **Submit to Play Store** (optional)

## File Locations

- **Debug APK:** `android/app/build/outputs/apk/debug/app-debug.apk`
- **Release APK:** `android/app/build/outputs/apk/release/app-release.apk`
- **Web Build:** `dist/` directory
- **Source Code:** `src/` directory

## Need Help?

- Read detailed instructions: `BUILD_INSTRUCTIONS.md`
- Check troubleshooting: `BUILD_INSTRUCTIONS.md#troubleshooting`
- Review app features: `README.md`

## Development Mode

To test changes quickly without rebuilding APK:

```bash
# 1. Start dev server
npm run dev

# 2. Update capacitor.config.json:
{
  "server": {
    "url": "http://YOUR_LOCAL_IP:3000",
    "cleartext": true
  }
}

# 3. Sync and open
npm run android:sync
npm run android:open

# Run on device/emulator from Android Studio
```

---

**Estimated Build Time:** 5-10 minutes (first time), 2-3 minutes (subsequent builds)

**APK Size:** ~8-15 MB

**Minimum Android Version:** Android 5.0 (API 21)

**Happy Building!** 🚀
