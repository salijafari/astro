const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const trackingTransparencyWebStub = path.resolve(
  projectRoot,
  "stubs/expo-tracking-transparency.web.js"
);

const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    platform === "web" &&
    (moduleName === "expo-tracking-transparency" ||
      moduleName.startsWith("expo-tracking-transparency/"))
  ) {
    return { type: "sourceFile", filePath: trackingTransparencyWebStub };
  }
  if (upstreamResolveRequest) {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });
