import settingsConfig from "./settings.vitest.config.mjs";

export default {
  ...settingsConfig,
  test: { ...settingsConfig.test, include: ["tests/profile.test.tsx"] },
};
