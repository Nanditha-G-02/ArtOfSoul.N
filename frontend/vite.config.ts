import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const api = process.env.VITE_API_PROXY ?? "http://localhost:8040";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5174, proxy: { "/api": api } },
  preview: { port: 5174, proxy: { "/api": api } },
});
