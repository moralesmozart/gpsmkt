import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Project site: https://moralesmozart.github.io/gpsmkt/
  base: command === 'build' ? '/gpsmkt/' : '/',
  plugins: [react()],
}))
