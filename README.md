# Ripple — Tactile Desktop Water Toy Game

**Ripple** is a physics skill game where you steer a floating puck across a dark, illuminated pool by tapping the water around it. You never touch the puck itself—every tap sends out a single expanding circular wave that pushes the puck away when the crest reaches it.

## Quick Start

```powershell
# 1. Compile TypeScript modules (src/*.ts -> dist/*.js)
node scripts/build.mjs

# 2. Run automated validation tests
node --test tests/validation.test.ts

# 3. Start local server at http://localhost:8090
node scripts/serve.mjs
```

## Core Rules & Mechanics

- **Never Touch the Puck**: Tapping directly on the puck is blocked. Tap the water around it:
  - Tap to its left to push it right.
  - Tap slightly behind a moving puck to accelerate it.
  - Tap ahead of a moving puck to brake it.
- **One Ripple at a Time (~0.5s Commitment)**: Only one wave can exist on the pool at a time. Every tap commits you for `0.50s`, requiring you to anticipate where the puck will be when your wave reaches it.
- **Clean Shots**: Pass through the inner bullseye centre of an illuminated hoop for a crystalline glassy chime, a luminous flash, and an ascending score multiplier (`×2`, `×3`...).
- **Recoveries**: Place a well-timed counter-ripple between a fast-moving puck and the pool's rim to arrest its momentum and earn a **CLOSE SAVE!** bonus.
- **Instant Restarts**: Touching the pool's edge or missing a hoop's countdown ends the run with a physics diagnostic (*"Tapped ~35ms too late"*), and another attempt starts immediately with a single tap.
