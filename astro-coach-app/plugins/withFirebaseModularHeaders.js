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

      // Add modular_headers for specific Firebase pods that need it
      const targetPods = [
        "GoogleUtilities",
        "FirebaseAuthInterop",
        "FirebaseAppCheckInterop",
        "FirebaseFirestoreInternal",
        "RecaptchaInterop",
      ];

      targetPods.forEach((pod) => {
        const podLine = new RegExp(`(pod '${pod}'[^\\n]*)`, "g");
        podfile = podfile.replace(podLine, `$1, :modular_headers => true`);
      });

      // If none of those pods are explicitly listed, use global use_modular_headers!
      if (!podfile.includes("use_modular_headers!")) {
        podfile = podfile.replace(
          "platform :ios,",
          "use_modular_headers!\nplatform :ios,"
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
