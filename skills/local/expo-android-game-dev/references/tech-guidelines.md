# Technical Guidelines (Expo Router)

## Suggested Layout

- `app/_layout.tsx`
- `app/(menu)/index.tsx`
- `app/(game)/index.tsx`
- `app/(game)/components/`
- `app/(game)/systems/`
- `app/(game)/hooks/`
- `components/` (shared UI)
- `assets/` (sprites, audio)

## Default Library Stack

- Rendering: `@shopify/react-native-skia` when you need custom drawing or many moving entities.
- Input: `react-native-gesture-handler` for deterministic touch/gesture handling.
- UI polish: `react-native-reanimated` for menus, transitions, and HUD effects (keep simulation in JS).
- Haptics: `expo-haptics` for feedback beats.
- Audio: `expo-audio` for SFX/music; avoid new work on `expo-av`.
- Persistence: `@react-native-async-storage/async-storage` for settings and meta-progression.
- Physics: `matter-js` for simple 2D; `planck` for Box2D-style joints/contacts and stable stacks.

## When to Avoid Extra Libraries

- For simple puzzle/board games, use standard React Native views and skip Skia.
- If animation needs are minimal, avoid Reanimated and keep effects lightweight.
- If collisions are simple, skip physics and use overlap checks.

## Game Loop
- Keep high-frequency state in refs or plain objects.
- Use a fixed timestep and accumulate delta to keep updates deterministic.
- Avoid per-frame React state updates; render from a single source of truth.

## Physics Guidance

- Use fixed timestep stepping and cap the max delta to avoid spiral-of-death behavior.
- Prefer `matter-js` for arcade physics and simple shapes.
- Use `planck` when you need constraints, joints, or robust stacking.
- Avoid `planck-js` (deprecated); use `planck`.

## Rendering
- Use the simplest rendering approach that satisfies visuals.
- Batch draws where possible and avoid excessive overdraw.
- Preload and cache sprites, audio, and fonts before gameplay starts.

## Input
- Prefer large hit targets and clear gestures.
- Debounce multi-touch or rapid taps if they cause unstable state.

## Performance
- Reduce allocations in the update loop.
- Avoid heavy layouts during gameplay.
- Test on a low-tier Android device early.

## Persistence
- Save only essential progress and settings.
- Keep save data schema versioned for future updates.

## Testing
- Make core systems deterministic for repeatable tests.
- Add unit tests for scoring, spawning, and progression rules.

## Reference Links

### Performance & Runtime
- React Native performance overview: https://reactnative.dev/docs/performance
- Optimizing JavaScript loading: https://reactnative.dev/docs/optimizing-javascript-loading
- Hermes engine overview: https://reactnative.dev/docs/hermes

### Rendering, Input, Motion
- Skia for Expo: https://docs.expo.dev/versions/latest/sdk/skia/
- Gesture handler (Expo): https://docs.expo.dev/versions/latest/sdk/gesture-handler/
- Reanimated shared values: https://docs.swmansion.com/react-native-reanimated/docs/fundamentals/shared-values/

### Audio & Haptics
- expo-haptics: https://docs.expo.dev/versions/latest/sdk/haptics/
- expo-audio: https://docs.expo.dev/versions/latest/sdk/audio/
- expo-video: https://docs.expo.dev/versions/latest/sdk/video/
- expo-av (deprecated; see deprecation notes): https://docs.expo.dev/versions/latest/sdk/av/

### Persistence
- AsyncStorage (removed from RN core): https://reactnative.dev/docs/asyncstorage
- Expo AsyncStorage package: https://docs.expo.dev/versions/latest/sdk/async-storage/

### Physics
- Matter.js (2D physics engine): https://brm.io/matter-js/
- Planck (Box2D-style physics): https://piqnt.com/planck.js/
- planck-js deprecation notice: https://www.npmjs.com/package/planck-js

### Release & Monetization (Android)
- Play Billing integration guide: https://developer.android.com/google/play/billing/integrate
- BillingClient API reference: https://developer.android.com/reference/com/android/billingclient/api/BillingClient
- Google Play policy (Monetization and Ads): https://support.google.com/googleplay/android-developer/answer/16549787
- Rewarded interstitial ads: https://developers.google.com/admob/android/rewarded-interstitial
- AdMob policies hub: https://transparency.google/our-policies/product-terms/google-admob
- Data safety disclosure guidance: https://support.google.com/googleplay/android-developer/answer/10787469
