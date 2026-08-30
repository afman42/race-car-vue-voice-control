import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// basicSsl is dev-only (local https for mic permission); never in prod build
export default defineConfig(async ({ mode }) => {
  const plugins = [vue()];
  if (mode === "development") {
    const { default: basicSsl } = await import("@vitejs/plugin-basic-ssl");
    plugins.push(basicSsl());
  }
  return {
    plugins,
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});
