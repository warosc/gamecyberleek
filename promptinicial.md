# PROJECT: LEEK OPS

# Web-first 2D Action Roguelite

# Development environment: VS Code + Docker

# Language: TypeScript

# Engine: Phaser 4

# Bundler: Vite

# Target: Desktop Web first, Mobile/PWA later

You are acting as the lead game engineer and software architect for a new
web-first 2D action roguelite called "LEEK OPS".

The main character is a cute tactical leek/vegetable soldier with:

- Green leek-shaped head/hair
- Black sunglasses
- Dark navy tactical armor
- Cyan/blue glowing accents
- Small cartoon proportions
- Strong recognizable silhouette
- Cute but combat-ready personality

The project must be designed as a REAL maintainable game, not as a quick
single-file HTML demo.

============================================================

1. PRIMARY OBJECTIVE
   \============================================================

Build the first playable vertical slice of LEEK OPS.

The first milestone must allow the developer to:

1. Clone/open the repository in VS Code
2. Run:

   docker compose up --build

3. Open:

   http://localhost:5173

4. Immediately play the game.

The first playable version must contain:

- Main menu
- Play button
- One arena
- Player character
- WASD movement
- Mouse aiming
- Left-click attack
- Space dash
- Enemies spawning
- Enemy/player collision
- Player health
- Enemy health
- Damage system
- Enemy death
- XP drops
- XP collection
- Level system
- Level-up screen
- Ability selection
- Basic particles
- Camera effects
- HUD
- Game over
- Restart

DO NOT implement multiplayer, database, authentication or TikTok integration
yet.

Architect the project so those features can be added later.

============================================================ 2. TECHNOLOGY STACK
============================================================

Use:

- TypeScript
- Phaser 4
- Vite
- Node.js 22 LTS
- Docker
- Docker Compose
- ESLint
- Prettier

Use Phaser's WebGL renderer.

Structure rendering code so experimental WebGPU features could be introduced
later without rewriting gameplay systems.

Do NOT use:

- jQuery
- giant HTML files
- inline JavaScript
- global state everywhere
- monolithic GameScene implementations
- unnecessary frameworks
- backend services during milestone 1

React is NOT required for the first milestone.

Use Phaser for the game UI initially.

============================================================ 3. DOCKER DEVELOPMENT ENVIRONMENT
============================================================

The application must run completely inside Docker.

Create:

Dockerfile
Dockerfile.prod
docker-compose.yml
.dockerignore

Development:

Node 22 Alpine
Vite development server
Hot Module Reloading

Expose:

5173

Bind the source directory so editing files from VS Code immediately updates
the running application.

The following must work:

docker compose up --build

without requiring Node.js/npm installed on the host.

Production build:

Multi-stage Docker build.

Stage 1:
Node 22
npm ci
npm run build

Stage 2:
nginx:alpine

Copy Vite /dist output to nginx.

============================================================ 4. VS CODE DEV CONTAINER
============================================================

Create:

.devcontainer/devcontainer.json

Configure VS Code to reopen the repository inside the development container.

Include useful extensions for:

- TypeScript
- ESLint
- Prettier
- Docker

Do not make the project dependent on proprietary VS Code extensions.

============================================================ 5. PROJECT STRUCTURE
============================================================

Create a scalable structure similar to:

src/

main.ts

game/

    config/
      GameConfig.ts
      Constants.ts

    scenes/
      BootScene.ts
      PreloadScene.ts
      MenuScene.ts
      GameScene.ts
      UIScene.ts
      GameOverScene.ts

    entities/

      player/
        Player.ts
        PlayerController.ts
        PlayerStats.ts

      enemies/
        Enemy.ts
        EnemyFactory.ts
        EnemyTypes.ts

      projectiles/
        Projectile.ts
        ProjectileManager.ts

    systems/
      CombatSystem.ts
      SpawnSystem.ts
      ExperienceSystem.ts
      LevelSystem.ts
      AbilitySystem.ts
      CollisionSystem.ts

    abilities/
      Ability.ts
      AbilityRegistry.ts
      definitions/

    components/
      HealthComponent.ts
      DamageComponent.ts
      MovementComponent.ts

    effects/
      ParticleManager.ts
      ScreenEffects.ts

    managers/
      AudioManager.ts
      InputManager.ts
      GameStateManager.ts

    ui/
      HUD.ts
      HealthBar.ts
      ExperienceBar.ts
      LevelUpPanel.ts

    utils/
      MathUtils.ts
      ObjectPool.ts

public/

assets/

    character/
      leek/

    enemies/

    maps/

    effects/

    audio/

    ui/

Do not create empty architecture purely for appearance.

Only create files that are useful now or clearly establish a required
extension point.

============================================================ 6. CHARACTER ASSET SYSTEM
============================================================

The main character will eventually use professionally separated animation
assets.

Prepare the asset architecture for:

head
hair/leaves
glasses
torso

left upper arm
left forearm
left hand

right upper arm
right forearm
right hand

left thigh
left leg
left boot

right thigh
right leg
right boot

The animation system must eventually support:

idle
walk
run
dash
attack
special attack
hurt
death
victory

For milestone 1, if final animation sprites are unavailable, DO NOT block
development.

Create a temporary visual representation while maintaining the correct
Player API.

All temporary assets must be clearly identified as placeholders.

Do NOT create fake external asset URLs.

============================================================ 7. PLAYER CONTROLS
============================================================

Desktop controls:

WASD:
movement

Mouse:
aim

Left mouse:
primary attack

Space:
dash

ESC:
pause

Player movement should feel responsive.

Movement must be normalized so diagonal movement is not faster.

Player should rotate/flip/aim visually toward the mouse where appropriate.

============================================================ 8. PLAYER STATS
============================================================

Create configurable player stats.

Initial suggested values:

Max HP: 100

Movement speed: 220

Dash speed: 600

Dash duration: 150 ms

Dash cooldown: 1000 ms

Attack damage: 20

Attack cooldown: 300 ms

Projectile speed: 700

Critical chance: 5%

XP multiplier: 1

Do not hardcode these values throughout the code.

Keep them centralized/configurable.

============================================================ 9. DASH
============================================================

Space activates dash.

Dash should:

- use movement direction
- briefly increase velocity
- have cooldown
- create a visual trail
- create subtle camera feedback

Architect it so invulnerability frames can be added later.

============================================================ 10. COMBAT
============================================================

Create a reusable damage pipeline.

Conceptually:

Attack
↓
Hit detection
↓
Damage calculation
↓
Health component
↓
Death event

Avoid tightly coupling player attacks directly to enemies.

The combat architecture should eventually support:

physical damage
energy damage
critical hits
status effects
area damage

Milestone 1 only needs basic damage + optional critical hits.

============================================================ 11. FIRST WEAPON
============================================================

Give the character a temporary energy weapon.

Working name:

LEEK BLASTER

Left mouse fires a cyan energy projectile toward the mouse cursor.

Add:

- projectile
- glow-like appearance
- small muzzle particle
- impact particle
- enemy hit reaction

Use object pooling where reasonable.

Do not create hundreds of destroyed/recreated objects every second.

============================================================ 12. ENEMIES
============================================================

Create at least THREE simple enemy archetypes.

Enemy 1:

GRUNT

- follows player
- medium speed
- low HP
- melee/contact damage

Enemy 2:

RUNNER

- faster
- lower HP
- smaller

Enemy 3:

TANK

- slow
- high HP
- larger
- more damage

Enemies should spawn outside or near the visible play area rather than
directly on top of the player.

Difficulty should gradually increase over time.

============================================================ 13. ENEMY FACTORY
============================================================

Do not instantiate enemy types throughout GameScene.

Use an EnemyFactory or equivalent pattern.

Example concept:

EnemyFactory.create(
EnemyType.GRUNT,
position
)

Enemy definitions should be data-driven where practical.

============================================================ 14. ARENA
============================================================

Create one temporary arena.

Theme:

CYBER VEGETABLE LAB

Visual direction:

dark navy background
cyan neon lines
subtle grid
industrial laboratory
small green accents

The player must remain within arena boundaries.

Do not spend excessive engineering effort on procedural maps yet.

============================================================ 15. EXPERIENCE SYSTEM
============================================================

Killed enemies drop XP orbs.

XP orb behavior:

1. Spawn at enemy death position
2. Remain temporarily
3. When player gets close, move toward player
4. Player collects it
5. XP bar increases

Use pooling where appropriate.

============================================================ 16. LEVEL SYSTEM
============================================================

When XP reaches threshold:

LEVEL UP

Pause gameplay.

Present THREE random upgrade options.

Player selects one.

Gameplay resumes.

Make the system data-driven.

============================================================ 17. FIRST UPGRADES
============================================================

Implement at least:

RAPID FIRE

- attack cooldown reduction

POWER SHOT

- increased damage

TURBO BOOTS

- increased movement speed

MULTI SHOT

- +1 projectile

ENERGY CORE

- +max HP
- heal part of HP

MAGNET

- larger XP collection radius

CRITICAL OPTICS

- increased critical chance

LEEK OVERDRIVE

- temporary/special offensive improvement

Each upgrade should support multiple levels when appropriate.

============================================================ 18. HUD
============================================================

Display:

Top-left:

HP
level

Top-center:

survival timer

Bottom:

XP bar

Optional:

dash cooldown

Keep UI readable and minimal.

============================================================ 19. GAME FEEL
============================================================

Game feel is important.

Implement subtle:

camera shake
hit flash
enemy knockback
particles
projectile trails
XP animation
damage numbers

Do not overdo screen shake.

Provide configuration values so effects can be adjusted.

============================================================ 20. GAME LOOP
============================================================

Target initial run:

5 minutes.

Flow:

MENU

↓

START

↓

SURVIVE

↓

KILL ENEMIES

↓

COLLECT XP

↓

LEVEL UP

↓

SELECT POWER

↓

MORE ENEMIES

↓

PLAYER DIES

↓

GAME OVER

↓

RESTART

This loop must work before expanding scope.

============================================================ 21. GAME STATE
============================================================

Create clear game states:

MENU
PLAYING
PAUSED
LEVEL_UP
GAME_OVER

Avoid boolean combinations such as:

isPlaying
isPaused
isDead
isSelectingUpgrade

when a proper state enum/state machine can represent the game state.

============================================================ 22. EVENT ARCHITECTURE
============================================================

Use Phaser events or a small typed event system for communication between
systems.

Useful events:

PLAYER_DAMAGED
PLAYER_DIED

ENEMY_DIED

XP_COLLECTED

PLAYER_LEVEL_UP

ABILITY_SELECTED

GAME_OVER

Avoid systems reaching deeply into unrelated objects.

============================================================ 23. PERFORMANCE
============================================================

Target:

60 FPS desktop.

Design with eventual mobile support.

Important:

- object pooling for frequently spawned objects
- avoid unnecessary allocations inside update()
- avoid unnecessary physics bodies
- remove event listeners when objects are destroyed
- avoid iterating giant arrays unnecessarily

Do not prematurely optimize insignificant code.

============================================================ 24. RESPONSIVE DISPLAY
============================================================

Game should adapt to browser size.

Recommended internal resolution:

1280x720

Use Phaser scale settings to maintain aspect ratio appropriately.

Support fullscreen later.

============================================================ 25. AUDIO
============================================================

Create AudioManager architecture.

If actual audio assets are unavailable, keep it functional without audio.

Eventually support:

shoot
hit
enemy death
XP collect
level up
dash
music

Do not load external copyrighted audio.

============================================================ 26. DEBUG MODE
============================================================

Implement:

VITE_DEBUG_GAME=true

When enabled display useful information such as:

FPS
enemy count
player position
projectile count
game state

Debug mode must be easy to disable.

============================================================ 27. CONFIGURATION
============================================================

Create:

.env.example

Example:

VITE_DEBUG_GAME=true
VITE_GAME_VERSION=0.1.0

Never commit secrets.

============================================================ 28. CODE QUALITY
============================================================

Use strict TypeScript.

Avoid `any` unless absolutely necessary.

Use descriptive names.

Functions should remain reasonably small.

Prefer composition over giant inheritance trees.

Document architecture decisions that are not obvious.

Do not comment obvious code.

============================================================ 29. TESTING
============================================================

Configure a lightweight test environment appropriate for TypeScript.

At minimum test logic that does not require Phaser rendering:

damage calculations
XP thresholds
upgrade calculations
player stat modifications

Do not attempt to unit test Phaser rendering.

============================================================ 30. README
============================================================

Create a professional README.md.

Include:

LEEK OPS

Description

Technology stack

Requirements

Quick Start

Development with Docker

Development with Dev Container

Controls

Project architecture

Adding an enemy

Adding an ability

Adding an animation

Production build

Troubleshooting

Future roadmap

============================================================ 31. COMMANDS
============================================================

The following commands should exist:

npm run dev

npm run build

npm run preview

npm run lint

npm run format

npm run test

And:

docker compose up --build

============================================================ 32. FUTURE ARCHITECTURE
============================================================

DO NOT implement these yet.

However, avoid architecture decisions that prevent adding:

PWA
mobile controls
gamepads
leaderboards
user accounts
cloud saves
achievements
skins
multiplayer
WebSockets
PostgreSQL
Redis
TikTok Live interaction
Twitch interaction
stream events
boss events
AI-assisted NPCs
procedural arenas

Future architecture could eventually become:

Browser
│
├── Phaser game
│
└── WebSocket
│
▼
Game API
│
┌────┴────┐
│ │
PostgreSQL Redis

But DO NOT build this backend during milestone 1.

============================================================ 33. STREAMING FUTURE
============================================================

The game will eventually support live-stream interaction.

Examples:

viewer sends event
↓
stream gateway
↓
game event
↓
spawn enemy

Possible events:

SPAWN_ENEMY
SPAWN_BOSS
DROP_HEALTH
DROP_CHEST
DOUBLE_ENEMIES
ACTIVATE_OVERDRIVE

Keep gameplay events sufficiently decoupled so these can eventually be
triggered externally.

DO NOT connect to TikTok or Twitch yet.

============================================================ 34. DEVELOPMENT METHODOLOGY
============================================================

IMPORTANT:

Do not attempt the entire game in one uncontrolled code generation.

Work incrementally.

Before changing code:

1. Inspect the repository.
2. Understand existing files.
3. Do not overwrite working code unnecessarily.
4. Explain major architectural decisions briefly.
5. Implement the smallest useful milestone.
6. Run tests/build/lint where appropriate.
7. Fix errors before continuing.

Never claim something works unless you have verified it when the environment
allows verification.

============================================================ 35. IMPLEMENTATION PHASES
============================================================

PHASE 1

Bootstrap:

Docker
Vite
TypeScript
Phaser
ESLint
Prettier
Dev Container
basic scenes

Verify:

docker compose up --build

and production build.

PHASE 2

Player:

placeholder character
WASD
mouse aim
dash
camera

PHASE 3

Combat:

Leek Blaster
projectiles
damage
enemy health

PHASE 4

Enemies:

Grunt
Runner
Tank
spawn system

PHASE 5

Progression:

XP
levels
upgrade selection
abilities

PHASE 6

Game feel:

particles
camera shake
damage numbers
hit effects
animation polish

PHASE 7

Replace placeholder character with final LEEK OPS assets.

============================================================ 36. IMPORTANT CODEX INSTRUCTION
============================================================

Do not merely explain how to create the project.

CREATE AND MODIFY THE FILES.

You have permission to create the complete initial project structure inside
the current workspace.

Start with PHASE 1.

After Phase 1:

- install dependencies
- build the project
- run lint
- run tests if present
- inspect errors
- fix errors

Then proceed to Phase 2 only if Phase 1 is healthy.

Continue incrementally through the playable vertical slice.

If a dependency/API differs from your assumptions because the installed
Phaser version has changed, inspect the installed package/documentation and
adapt the implementation rather than forcing obsolete APIs.

Do not downgrade dependencies simply to make generated code work unless
there is a strong technical reason.

============================================================ 37. ART DIRECTION
============================================================

Maintain the visual identity:

Cute tactical cyberpunk cartoon.

Palette:

dark navy
black
cyan neon
bright leek green
small white highlights

Character personality:

confident
cute
slightly arrogant
heroic
funny

The game should NOT look like a generic developer prototype once visual
polish begins.

============================================================ 38. FIRST SUCCESS CRITERIA
============================================================

The first major success condition is:

I execute:

docker compose up --build

Open:

http://localhost:5173

Click:

PLAY

And can:

MOVE with WASD
AIM with mouse
SHOOT with left click
DASH with SPACE
KILL enemies
COLLECT XP
LEVEL UP
SELECT upgrades
TAKE damage
DIE
RESTART

with no critical console errors.

============================================================ 39. START NOW
============================================================

Inspect the current workspace.

If it is empty, initialize the project.

If files already exist, preserve useful existing work.

Start implementing PHASE 1.

Do not ask me to manually create files that you can create yourself.

Do not stop after giving instructions.

Actually implement the project.
