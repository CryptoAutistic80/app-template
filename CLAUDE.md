# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design Source

**Read [game_spec.md](game_spec.md) for all game design decisions.** It contains the TypeScript schemas, room templates, tuning config, and implementation order. That file is the source of truth—do not duplicate its content here.

## Development Commands

```bash
npm run start       # Start Expo dev server
npm run android     # Start on Android
npm run ios         # Start on iOS
npm run web         # Start on web
npm run lint        # Run ESLint
```

## Project Structure

- `app/` - expo-router screens and layouts (file-based routing)
- `components/` - Reusable UI components
- `constants/theme.ts` - Colors and fonts for light/dark mode
- `hooks/` - Custom React hooks

### Path Aliases
- `@/*` maps to project root (e.g., `@/components/`, `@/hooks/`)
