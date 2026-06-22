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

## Notes

- API calls go to `https://learn.lexiland.cc/api/*` from the WebView
- Service Worker is disabled in Capacitor; PWA web version unchanged
- OAuth / Deep Link login is **Sprint 2** (not in this sprint)

## Android (optional)

```bash
npm run cap:android
```

Open Android Studio, run on device/emulator.
