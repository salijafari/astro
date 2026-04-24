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

      if (!podfile.includes("# RNFirebase modular headers fix")) {
        const patch = [
          "",
          "  # RNFirebase modular headers fix",
          "  installer.pods_project.targets.each do |target|",
          "    if ['GoogleUtilities', 'FirebaseAuthInterop', 'FirebaseAppCheckInterop', 'RecaptchaInterop', 'FirebaseFirestoreInternal'].include?(target.name)",
          "      target.build_configurations.each do |config|",
          "        config.build_settings['DEFINES_MODULE'] = 'YES'",
          "      end",
          "    end",
          "  end",
          "",
        ].join("\n");

        const postInstall = "post_install do |installer|";
        if (podfile.includes(postInstall)) {
          podfile = podfile.replace(postInstall, postInstall + patch);
        }

        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};
