import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
export default tseslint.config(
  { ignores: ['dist', 'coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    rules: {
      // Phaser's types declare a global `Phaser` namespace, so a file that uses `Phaser.x`
      // without importing it compiles and lints clean, then throws "Phaser is not defined" at
      // runtime under ESM. That shipped once and froze the game on every level-up. ESLint does
      // not read .d.ts files, so an unimported `Phaser` is an unresolved global here and this
      // rule catches it; an imported one is a local binding and is left alone.
      'no-restricted-globals': [
        'error',
        {
          name: 'Phaser',
          message: "Import Phaser explicitly: `import Phaser from 'phaser'`.",
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          // A Scene's `events` is its system emitter, shared with Phaser's own plugins.
          // Wiping it unsubscribes ArcadePhysics.start, so the next run of the scene boots
          // with a null physics world and the game loop dies in create().
          selector:
            "CallExpression[callee.property.name='removeAllListeners'][callee.object.property.name='events']",
          message:
            'Do not clear a Scene event emitter wholesale; remove your own listeners with events.off(name).',
        },
      ],
    },
  },
  prettier,
);
