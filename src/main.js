import { createApp } from "vue";
import App from "./App.vue";
import { validateConfig } from "./config";

validateConfig();

createApp(App).mount("#app");
