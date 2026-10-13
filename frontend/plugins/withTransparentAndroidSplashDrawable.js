const fs = require('node:fs/promises');
const path = require('node:path');
const { withDangerousMod } = require('expo/config-plugins');

module.exports = function withTransparentAndroidSplashDrawable(config) {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const drawableDirectory = path.join(
        config.modRequest.projectRoot,
        'android',
        'app',
        'src',
        'main',
        'res',
        'drawable',
      );
      await fs.mkdir(drawableDirectory, { recursive: true });
      await fs.writeFile(
        path.join(drawableDirectory, 'splashscreen_logo.xml'),
        `<vector xmlns:android="http://schemas.android.com/apk/res/android"
  android:width="1dp"
  android:height="1dp"
  android:viewportWidth="1"
  android:viewportHeight="1">
  <path android:fillColor="#00000000" android:pathData="M0,0h1v1h-1z" />
</vector>
`,
      );
      return config;
    },
  ]);
};
