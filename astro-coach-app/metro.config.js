const path = require("path");
const { withNativeWind } = require("nativewind/metro");
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const projectRoot = __dirname;
const config = getSentryExpoConfig(projectRoot);

const { transformer, resolver } = config;
config.transformer = {
  ...transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer/expo"),
};
config.resolver = {
  ...resolver,
  assetExts: resolver.assetExts.filter((ext) => ext !== "svg"),
  sourceExts: resolver.sourceExts.includes("svg")
    ? resolver.sourceExts
    : [...resolver.sourceExts, "svg"],
};

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