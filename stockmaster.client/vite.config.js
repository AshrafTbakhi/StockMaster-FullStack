
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],

    server: {
        host: 'localhost',
        port: 5173,

        proxy: {
            '/api': {
                target: 'https://localhost:7106',
                changeOrigin: true,
                secure: false,
            },
        },
    },
})
