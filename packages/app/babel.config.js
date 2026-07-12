module.exports = function (api) {
  api.cache(true);
  return {
    // unstable_transformImportMeta: @clerk/shared's getEnvVariable.mjs uses
    // `import.meta.env` (for web/Vite bundler compatibility) — Hermes doesn't
    // support that syntax natively, so without this the bundle fails to build
    // as soon as anything imports that file (the OAuth/useSSO code path did).
    presets: [['babel-preset-expo', { unstable_transformImportMeta: true }]],
  };
};
