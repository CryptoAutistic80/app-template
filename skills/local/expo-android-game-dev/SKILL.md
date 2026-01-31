---
name: expo-android-game-dev
description: Game design and development guidance for Android games built with React Native Expo (Expo Router). Use when asked to design a game, give game design advice, or implement a game from a spec (e.g., "build the spec in {file.md}", "help me with my game", "I need some game design advice"), including architecture, performance, UI/UX, and Android release readiness.
---

# Expo Android Game Dev

## Quick Start

- Identify the request type: spec creation, design advice, implementation help, or optimization.
- Ask 3-5 focused questions if the request is underspecified (genre, target audience, control scheme, device targets, and core loop).
- Default to Expo Router and a lightweight custom game loop; add specialized libraries only when requirements justify them.
- Use the spec template in `assets/game-spec-template.md` for spec-first requests and fill it with concrete decisions and open questions.

## Authoritative Docs (Core)

- Expo Router introduction: https://docs.expo.dev/router/introduction/
- Navigation in Expo and React Native apps (Expo Router recommended): https://docs.expo.dev/develop/dynamic-routes/
- Development builds (dev client) vs Expo Go: https://docs.expo.dev/develop/development-builds/create-a-build/
- EAS Build intro / first build: https://docs.expo.dev/build/introduction/ and https://docs.expo.dev/build/setup
- Submit to Google Play: https://docs.expo.dev/submit/android/
- Skia in Expo: https://docs.expo.dev/versions/latest/sdk/skia/
- Gesture handling in Expo: https://docs.expo.dev/versions/latest/sdk/gesture-handler/

## Default Decisions

- Target Android first; clarify device performance tier and orientation early.
- Prefer minimal dependencies; implement systems (input, physics-lite, spawn, scoring) as plain modules.
- Default library stack for games:
  - Rendering: `@shopify/react-native-skia` for custom drawing or many moving entities.
  - Input: `react-native-gesture-handler`.
  - UI polish only: `react-native-reanimated`.
  - Haptics: `expo-haptics`.
  - Audio: `expo-audio` (avoid new work on `expo-av`).
  - Persistence: `@react-native-async-storage/async-storage`.
  - Physics: `matter-js` for simple 2D; `planck` (Box2D-style) for joints/stack stability. Avoid `planck-js` (deprecated).
- Avoid per-frame React state updates; keep high-frequency state in refs and draw/update imperatively.
- Prioritize clarity and playability over feature breadth; keep the loop tight and tune frequently.

## Workflows

- Follow the step-by-step flows in `references/workflows.md`.
- Use `references/design-checklist.md` to audit or improve gameplay and retention.
- Use `references/tech-guidelines.md` for architecture, performance, and Expo Router layout.

## Output Expectations

- Provide actionable, ranked recommendations with tradeoffs.
- When building or editing files, keep changes minimal and align with the existing repo structure.
- Call out risks, unknowns, and the smallest next experiment to validate assumptions.

## Resources

### references/
- `references/workflows.md`
- `references/design-checklist.md`
- `references/tech-guidelines.md`

### assets/
- `assets/game-spec-template.md`
