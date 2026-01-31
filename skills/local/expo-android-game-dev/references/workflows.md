# Workflows

## Spec-First ("build the spec in {file.md}")

1. Confirm essentials: genre, target audience, platform (Android), orientation, and control scheme.
2. Define the core loop in one sentence; extract 2-3 design pillars.
3. Copy `assets/game-spec-template.md` into the requested file and fill it out.
4. Mark unknowns as TBD and list 3-5 questions to resolve next.
5. End with a short MVP scope and the next development milestone.

## Design Advice ("help me with my game", "I need design advice")

1. Ask for the current state: what exists, what feels off, and the intended player fantasy.
2. Diagnose the loop (time-to-fun, clarity, challenge curve, and feedback).
3. Provide 3-5 concrete, testable changes; prioritize the smallest high-impact change first.
4. Suggest a quick playtest plan and measurable success criteria.

## Implementation Help

1. Map the spec to screens (menu, game, results) and systems (input, scoring, spawn, persistence).
2. Place files under Expo Router with clear separation between UI and game systems.
3. Implement a simple update loop and deterministic systems first; add polish after the loop is stable.
4. Add performance safeguards early (fixed timestep, culling, preloading assets).
5. Keep a short backlog of polish and content tasks.

## Optimization / Debugging

1. Identify the slow path (render, update, or asset loading).
2. Reduce per-frame allocations and React re-renders.
3. Use simpler visuals before adding heavy effects.
4. Verify performance on a low-tier Android device.

## Reference Links

- Expo Router core concepts: https://docs.expo.dev/router/basics/core-concepts/
- Expo Router Stack guide: https://docs.expo.dev/router/advanced/stack/
- EAS Build overview: https://docs.expo.dev/build/introduction/
- Android builds reference: https://docs.expo.dev/build-reference/android-builds/
- Debugging and profiling tools: https://docs.expo.dev/guides/using-flipper/
- New Architecture guidance: https://docs.expo.dev/guides/new-architecture/
- EAS Update overview: https://docs.expo.dev/eas-update/introduction/
- Send OTA updates: https://docs.expo.dev/deploy/send-over-the-air-updates/
- expo-updates SDK: https://docs.expo.dev/versions/latest/sdk/updates/
