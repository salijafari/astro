const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withFirebaseModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      const modularHeadersPatch = `
  # Fix for React Native Firebase modular headers
  installer.pods_project.targets.each do |target|
    if ['GoogleUtilities', 'FirebaseFirestoreInternal', 'FirebaseAuthInterop', 'FirebaseAppCheckInterop', 'RecaptchaInterop'].include?(target.name)
      target.build_configurations.each do |config|
        config.build_settings['DEFINES_MODULE'] = 'YES'
      end
    end
  end
`;

      const postInstallHook = "post_install do |installer|";
      if (
        podfile.includes(postInstallHook) &&
        !podfile.includes("Fix for React Native Firebase modular headers")
      ) {
        podfile = podfile.replace(
          postInstallHook,
          postInstallHook + modularHeadersPatch
        );
        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};
