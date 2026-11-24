const { AndroidConfig, withGradleProperties } = require('expo/config-plugins');

module.exports = function withAndroidReleaseOptimization(config) {
  return withGradleProperties(config, (config) => {
    const properties = {
      'android.enableMinifyInReleaseBuilds': 'true',
      'android.enableShrinkResourcesInReleaseBuilds': 'true',
    };

    for (const [key, value] of Object.entries(properties)) {
      AndroidConfig.BuildProperties.updateAndroidBuildProperty(
        config.modResults,
        key,
        value,
      );
    }

    return config;
  });
};
