import { defineConfig } from 'vite'

// Minimal Vite config - omit @vitejs/plugin-react to avoid ESM/exports resolution
// issues when running in environments where plugin/react and vite versions
// are mismatched. The app works fine without the plugin for development; if
// you want React fast-refresh, install a matching @vitejs/plugin-react version
// or use the official plugin that matches your Vite release.
export default defineConfig({
	plugins: [],
	server: {
		host: '127.0.0.1',
		port: 5173,
		strictPort: true,
		proxy: {
			// Forward /api to the local Wrangler dev server used by this project.
			'/api': {
				target: 'http://127.0.0.1:8787',
				changeOrigin: true,
				secure: false,
			},
		},
	},
})
