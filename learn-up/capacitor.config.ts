import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.learnup.app",
  appName: "Learn Up",
  webDir: "public",
  server: {
    url: "https://learn-up-qmgx.onrender.com",
    cleartext: true,
  },
};

export default config;
