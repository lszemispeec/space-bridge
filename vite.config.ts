import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      input: {
        game: fileURLToPath(new URL('./index.html', import.meta.url)),
        audioDemo: fileURLToPath(new URL('./audio-demo.html', import.meta.url)),
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
