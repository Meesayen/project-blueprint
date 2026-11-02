import vue from '@vitejs/plugin-vue';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, lazyPlugins } from 'vite-plus';

// https://vite.dev/config/
export default defineConfig({
  fmt: {
    singleQuote: true,
    semi: true,
    tabWidth: 2,
    trailingComma: 'all',
    printWidth: 100,
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
  plugins: lazyPlugins(() => [vue(), tailwindcss()]),
});
