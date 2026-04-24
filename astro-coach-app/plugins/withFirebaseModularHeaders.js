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

      if (!podfile.includes("# RNFirebase modular headers")) {
        const injection = [
          "# RNFirebase modular headers",
          "pod 'GoogleUtilities', :modular_headers => true",
          "pod 'FirebaseAuthInterop', :modular_headers => true",
          "pod 'FirebaseAppCheckInterop', :modular_headers => true",
          "pod 'RecaptchaInterop', :modular_headers => true",
          "pod 'FirebaseFirestoreInternal', :modular_headers => true",
          "",
        ].join("\n  ");

        // Inject before the first 'target' block
        podfile = podfile.replace(
          /^(target ['"])/m,
          `  ${injection}\n$1`
        );

        fs.writeFileSync(podfilePath, podfile);
      }

      return config;
    },
  ]);
};
