const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const nativeOnlyPackages = {
  // expo-file-system 18.0.x has a broken web module that crashes registerWebModule.
  // On web, imageToBase64.web.ts uses fetch/FileReader instead — so this is safe to stub.
  'expo-file-system': path.resolve(__dirname, 'src/stubs/expo-file-system.web.js'),
};

const originalResolveRequest = config.resolver?.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && nativeOnlyPackages[moduleName]) {
    return {
      type: 'sourceFile',
      filePath: nativeOnlyPackages[moduleName],
    };
  }
  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
