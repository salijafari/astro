/**
 * Expo config plugin: React Native Firebase iOS build fix
 *
 * WHAT THIS DOES
 * --------------
 * When using @react-native-firebase/* with `useFrameworks: "static"` on iOS,
 * RNFB's framework modules import React headers like <React/RCTConvert.h>.
 * React-Core does not define a module, so clang throws:
 *   "include of non-modular header inside framework module RNFBApp..."
 *
 * The fix is a single build setting: CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES = YES.
 * This tells clang to relax that check. No pod redeclaration, no use_modular_headers!,
 * no gRPC exceptions — all of which cause the abseil xcprivacy.bundle duplication.
 *
 * This plugin injects that setting into the generated ios/Podfile's post_install block.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '# @akhtar/rnfb-modular-headers-fix';

const PATCH_BLOCK = `
    ${MARKER}
    # Required for React Native Firebase + useFrameworks: "static".
    # Allows RNFB framework modules to import non-modular React headers.
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |build_config|
        build_config.build_settings['CLANG_ALLOW_NON_MODULAR_INCLUDES_IN_FRAMEWORK_MODULES'] = 'YES'
      end
    end
`;

const withFirebaseModularHeaders = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        'Podfile'
      );

      if (!fs.existsSync(podfilePath)) {
        throw new Error(
          `[withFirebaseModularHeaders] Podfile not found at ${podfilePath}`
        );
      }

      let contents = fs.readFileSync(podfilePath, 'utf-8');

      // Idempotency: if we've already patched this Podfile, do nothing.
      if (contents.includes(MARKER)) {
        return config;
      }

      // Find the react_native_post_install(...) call and walk the parentheses
      // to find its matching close paren. Inject our patch immediately after it.
      const anchor = 'react_native_post_install(';
      const anchorIndex = contents.indexOf(anchor);

      if (anchorIndex === -1) {
        throw new Error(
          '[withFirebaseModularHeaders] Could not find react_native_post_install(...) ' +
            'in the generated Podfile. The Expo template may have changed.'
        );
      }

      let depth = 1;
      let cursor = anchorIndex + anchor.length;
      while (cursor < contents.length && depth > 0) {
        const ch = contents[cursor];
        if (ch === '(') depth++;
        else if (ch === ')') depth--;
        cursor++;
      }

      if (depth !== 0) {
        throw new Error(
          '[withFirebaseModularHeaders] Failed to find matching close paren for ' +
            'react_native_post_install(). The Podfile may be malformed.'
        );
      }

      const before = contents.slice(0, cursor);
      const after = contents.slice(cursor);
      contents = before + '\n' + PATCH_BLOCK + after;

      fs.writeFileSync(podfilePath, contents, 'utf-8');
      return config;
    },
  ]);
};

module.exports = withFirebaseModularHeaders;
