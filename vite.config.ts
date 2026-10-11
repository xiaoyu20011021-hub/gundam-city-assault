import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three-runtime', test: /node_modules[\\/]three[\\/]/, minSize: 20_000, maxSize: 280_000, priority: 10 }],
        },
      },
    },
  },
});
