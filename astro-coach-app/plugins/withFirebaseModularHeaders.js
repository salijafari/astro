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

      if (!podfile.includes("use_modular_headers!")) {
        podfile = podfile.replace(
          "platform :ios,",
          "use_modular_headers!\nplatform :ios,"
        );
      }

      if (!podfile.includes("gRPC-C++.*modular_headers => false")) {
        podfile = podfile.replace(
          "use_modular_headers!\nplatform :ios,",
          "use_modular_headers!\npod 'gRPC-C++', :modular_headers => false\npod 'gRPC-Core', :modular_headers => false\nplatform :ios,"
        );
      }

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
