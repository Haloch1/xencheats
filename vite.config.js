import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3000,
    proxy: {
      "/api": "http://127.0.0.1:4242",
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        products: path.resolve(__dirname, "products/index.html"),
        account: path.resolve(__dirname, "account/index.html"),
        status: path.resolve(__dirname, "status/index.html"),
        desk: path.resolve(__dirname, "desk/index.html"),
        deskAdmin: path.resolve(__dirname, "desk-admin/index.html"),
        requests: path.resolve(__dirname, "requests/index.html"),
        checkoutSuccess: path.resolve(__dirname, "checkout/success/index.html"),
        checkoutCancel: path.resolve(__dirname, "checkout/cancel/index.html"),
      },
    },
  },
});
