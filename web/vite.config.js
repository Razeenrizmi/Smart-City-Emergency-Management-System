import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Optional same-origin proxy for the iPhone MJPEG stream (Node 2).
  // Set VITE_PHONE_CAMERA_PROXY=http://<iphone-ip>:<port> in web/.env and point
  // VITE_PHONE_CAMERA_URL at /phonecam/<path> so the browser loads the stream
  // from the Vite origin — required for canvas frame capture (no CORS taint).
  const phoneProxy = env.VITE_PHONE_CAMERA_PROXY || ''
  return {
    plugins: [react()],
    server: phoneProxy
      ? {
          proxy: {
            '/phonecam': {
              target: phoneProxy,
              changeOrigin: true,
              rewrite: (path) => path.replace(/^\/phonecam/, ''),
            },
          },
        }
      : {},
  }
})
