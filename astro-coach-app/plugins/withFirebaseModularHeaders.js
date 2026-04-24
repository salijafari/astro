const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MODULAR_PODS = [
  "GoogleUtilities",
  "FirebaseAuthInterop",
  "FirebaseAppCheckInterop",
  "RecaptchaInterop",
  "FirebaseFirestoreInternal",
];

module.exports = function withFirebaseModularHeaders(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfile = fs.readFileSync(podfilePath, "utf8");

      if (!podfile.includes("# RNFirebase modular headers fix")) {
        const patch = `
  # RNFirebase modular headers fix
  installer.pods_project.targets.each do |target|
    if ${JSON.stringify(MODULAR_PODS)}.include?(target.name)
      target.build_configurations.each do |config|
        config.build_settings['DEFINES_MODULE'] = 'YES'
        config.build_settings['SWIFT_INCLUDE_PATHS'] = '$(inherited) ${PODS_CONFIGURATION_BUILD_DIR}'
      end
    end
  end
`;
        podfile = podfile.replace(
          /(\s*end\s*$)/m,
          `${patch}\n$1`
        );
        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};
