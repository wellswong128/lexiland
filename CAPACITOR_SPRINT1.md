# Capacitor Sprint 1 — Local iOS Debug

Sprint 1 adds the native shell and remote API wiring. Run these steps on a Mac with Xcode.

## 1. Install dependencies

```bash
npm install
```

## 2. Configure env (optional for Guest + photo AI)

Copy `.env.capacitor.example` values into `.env.local` if you need Supabase login later. Guest mode and local flashcards work without it.

For photo AI scan in the native app, ensure production API is reachable:

```bash
VITE_API_BASE_URL=https://learn.lexiland.cc
```

## 3. Sync web build into native projects

```bash
npm run cap:sync
```

## 4. Open Xcode

```bash
npm run cap:ios
```

Or:

```bash
npx cap open ios
```

## 5. Run on iPhone

1. Select your iPhone as the run target
2. Set **Signing & Capabilities** → Team
3. Press Run (⌘R)

## 6. Sprint 1 acceptance (Guest)

- [ ] App opens to homepage
- [ ] **先不登入，繼續使用** flow works (skip login if prompted)
- [ ] **拍照加字** → camera / photo library → AI extract (needs network)
- [ ] Save words → **字卡** review works offline after first load
- [ ] Settings → PWA status shows **原生 App** (Service Worker disabled)

## 7. Native login (Google / Email) — Supabase setup

Capacitor login uses a **custom URL scheme**, not only `capacitor://localhost`.

1. In Xcode, note your **Bundle Identifier** (e.g. `com.wellswong.lexiland`)
2. Create `.env.local` before `npm run cap:sync`:

```bash
VITE_CAPACITOR_APP_ID=com.wellswong.lexiland
VITE_NATIVE_AUTH_REDIRECT_URL=com.wellswong.lexiland://auth/callback
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

3. In **Supabase → Authentication → URL Configuration → Redirect URLs**, add **all** of:

```text
capacitor://localhost/auth/callback
capacitor://**
https://localhost/auth/callback
https://localhost/**
https://learn.lexiland.cc/**
```

Important: `https://learn.lexiland.cc/` alone does **not** cover sub-paths. Use `https://learn.lexiland.cc/**`.

4. Rebuild and sync:

```bash
npm run cap:sync
```

5. Run again from Xcode. Google login opens in-app browser and should return to the app.

## Notes

- API calls go to `https://learn.lexiland.cc/api/*` from the WebView
- Service Worker is disabled in Capacitor; PWA web version unchanged
- OAuth / Deep Link login is **Sprint 2** (not in this sprint)

## Android

### Prerequisites

- [Android Studio](https://developer.android.com/studio) (includes JDK 17+)
- Android SDK Platform 36 (installed via Android Studio SDK Manager)

### 1. Configure env

Copy values from `.env.capacitor.example` into `.env.local`:

```bash
VITE_API_BASE_URL=https://learn.lexiland.cc
VITE_CAPACITOR_APP_ID=com.lexiland.app
VITE_NATIVE_AUTH_REDIRECT_URL=com.lexiland.app://auth/callback
```

For Supabase login, also add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, then add these **Redirect URLs** in Supabase:

```text
com.lexiland.app://auth/callback
com.lexiland.app://**
capacitor://localhost/auth/callback
capacitor://**
https://learn.lexiland.cc/**
```

### 2. Build and sync

```bash
npm run cap:sync
```

This builds the web app into `dist/` and copies it into `android/app/src/main/assets/public`.

### 3. Open Android Studio

```bash
npm run cap:android
```

Or:

```bash
npx cap open android
```

### 4. Run on device or emulator

1. Connect an Android phone (USB debugging) or start an emulator
2. Click **Run** in Android Studio

### 5. Build APK from terminal (optional)

```bash
npm run cap:android:apk
```

Debug APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Release build (requires signing config in Android Studio):

```bash
npm run cap:android:release
```

### Android acceptance

- [ ] App opens to homepage
- [ ] Guest mode works without login
- [ ] Photo add opens camera / gallery
- [ ] Flashcards and quiz work
- [ ] Google / email login returns via `com.lexiland.app://auth/callback`
