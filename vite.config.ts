import { defineConfig } from 'vite'

// Minimal Vite config - omit @vitejs/plugin-react to avoid ESM/exports resolution
// issues when running in environments where plugin/react and vite versions
// are mismatched. The app works fine without the plugin for development; if
// you want React fast-refresh, install a matching @vitejs/plugin-react version
// or use the official plugin that matches your Vite release.
export default defineConfig({
	plugins: [],
})
