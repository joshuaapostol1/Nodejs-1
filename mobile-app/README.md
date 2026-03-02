# ShareBooster Mobile App

Android mobile application for the ShareBooster Facebook share automation platform.

## Features

- User authentication (Login/Register with OTP verification)
- Facebook share automation
- Real-time share status tracking
- Premium subscription management
- Cookie storage for quick access
- Modern, intuitive mobile UI
- Offline capability

## Tech Stack

- **Frontend Framework:** Vue 3
- **Build Tool:** Vite
- **Mobile Framework:** Capacitor 6
- **HTTP Client:** Axios
- **Router:** Vue Router
- **Platform:** Android (iOS support can be added)

## Project Structure

```
mobile-app/
├── src/
│   ├── views/           # App screens/pages
│   │   ├── Splash.vue
│   │   ├── Login.vue
│   │   ├── Register.vue
│   │   ├── Home.vue
│   │   ├── Share.vue
│   │   ├── Status.vue
│   │   ├── Profile.vue
│   │   └── Premium.vue
│   ├── services/        # API and auth services
│   │   ├── api.js
│   │   └── auth.js
│   ├── router/          # Vue Router configuration
│   │   └── index.js
│   ├── App.vue          # Root component
│   └── main.js          # App entry point
├── android/             # Native Android project (generated)
├── dist/                # Built web app (generated)
├── capacitor.config.json # Capacitor configuration
├── vite.config.js       # Vite build configuration
├── package.json         # Dependencies and scripts
└── BUILD_INSTRUCTIONS.md # Detailed build guide

## Quick Start

### Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create `.env` file:
   ```bash
   VITE_API_URL=https://sharebooster.sbs
   ```

3. Start development server:
   ```bash
   npm run dev
   ```

### Build for Android

1. Build web app:
   ```bash
   npm run build
   ```

2. Add Android platform (first time only):
   ```bash
   npm run android:add
   ```

3. Sync files:
   ```bash
   npm run android:sync
   ```

4. Build APK:
   ```bash
   npm run android:build:debug  # For testing
   # or
   npm run android:build        # For production (requires signing setup)
   ```

5. Find your APK at:
   - Debug: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Release: `android/app/build/outputs/apk/release/app-release.apk`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production web app
- `npm run android:add` - Add Android platform
- `npm run android:sync` - Sync web app to Android
- `npm run android:open` - Open in Android Studio
- `npm run android:build:debug` - Build debug APK
- `npm run android:build` - Build release APK

## Configuration

### API URL

Set your backend API URL in `.env`:

```bash
# Production
VITE_API_URL=https://sharebooster.sbs

# Development (use your local IP, not localhost)
VITE_API_URL=http://192.168.1.100:5000
```

### App Configuration

Edit `capacitor.config.json` to customize:
- App name
- App ID (package name)
- Splash screen settings
- Status bar settings

## Features by Screen

### Splash Screen
- App branding
- Auto-redirects to login or home based on auth status

### Login/Register
- Email/password authentication
- OTP verification for registration
- Form validation
- Error handling

### Home
- User profile summary
- Share statistics
- Quick action buttons
- Premium status display

### Share
- Post URL input
- Share amount configuration
- Interval settings
- Cookie management
- Save cookies for reuse

### Status
- Real-time share progress
- Active session details
- Share logs
- Stop sharing functionality

### Profile
- User information display
- Change password
- Premium status
- Logout

### Premium
- Premium benefits overview
- Plan selection
- Request premium upgrade

## Backend Integration

The app connects to the ShareBooster backend API. Key endpoints used:

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/verify-otp` - Verify OTP
- `POST /api/submit` - Start share session
- `GET /share-status` - Get share status
- `POST /stop-share` - Stop sharing
- `POST /api/premium/request` - Request premium
- `POST /api/cookies/save` - Save Facebook cookie
- `GET /api/cookies/get` - Load saved cookie

## Authentication

The app uses JWT token-based authentication:

1. User logs in with credentials
2. Backend returns JWT token
3. Token stored in localStorage
4. Token included in all API requests via `Authorization: Bearer <token>` header
5. Auto-logout on 401 responses

## State Management

User state and authentication managed through:
- `authService` - Token and user data management
- `localStorage` - Persistent storage
- Vue Router navigation guards - Route protection

## Building for Production

See [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md) for detailed instructions on:
- Environment setup
- Keystore creation
- APK signing
- Distribution
- Troubleshooting

## Requirements

- Node.js 18+
- Java JDK 17
- Android Studio (with Android SDK)
- Gradle

## File Size

- APK Size: ~8-15 MB (varies with optimizations)
- Supports Android 5.0+ (API level 21+)

## Security

- JWT tokens for authentication
- Secure cookie storage
- HTTPS for API communication
- Input validation
- XSS protection

## Known Limitations

- Android only (iOS support requires separate setup)
- Requires internet connection for share operations
- Maximum share limits apply (500 free, 4000 premium)

## Future Enhancements

- [ ] iOS support
- [ ] Push notifications for share completion
- [ ] Dark mode
- [ ] Multiple language support
- [ ] Share scheduling
- [ ] Analytics dashboard
- [ ] In-app purchases for premium

## Support

For build issues or questions, refer to:
- [BUILD_INSTRUCTIONS.md](BUILD_INSTRUCTIONS.md)
- [Capacitor Docs](https://capacitorjs.com/docs)
- Backend API documentation

## License

This project is part of the ShareBooster platform.

---

**Built with ❤️ using Vue.js and Capacitor**
