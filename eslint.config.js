// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    // supabase/ is Deno server code, checked with `deno check` instead.
    ignores: ['dist/*', 'supabase/*'],
  },
]);
