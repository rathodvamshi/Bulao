const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');
const fs = require('fs');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../');

const config = getDefaultConfig(projectRoot);

function resolvePkg(name, fromDir) {
  try {
    return path.dirname(require.resolve(`${name}/package.json`, { paths: [fromDir] }));
  } catch {
    return null;
  }
}

const expoRouterDir = resolvePkg('expo-router', projectRoot);
const metroRuntimeDir =
  resolvePkg('@expo/metro-runtime', expoRouterDir || projectRoot) ||
  resolvePkg('@expo/metro-runtime', projectRoot) ||
  resolvePkg('@expo/metro-runtime', workspaceRoot);

const extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
};
if (metroRuntimeDir && fs.existsSync(metroRuntimeDir)) {
  extraNodeModules['@expo/metro-runtime'] = metroRuntimeDir;
}

// ── Monorepo & Performance Optimizations ────────────────────────────────────
config.watchFolders = [
  path.resolve(workspaceRoot, 'packages'),
  path.resolve(workspaceRoot, 'node_modules'),
];

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  extraNodeModules,
  unstable_enableSymlinks: true,
  blockList: [
    /.*[/\\]backend[/\\].*/,
    /.*[/\\]\.git[/\\].*/,
    /.*[/\\]\.pnpm-store[/\\].*/,
    /.*[/\\]Bulao_design[/\\].*/,
    /.*[/\\]docs[/\\].*/,
  ],
};

module.exports = withNativeWind(config, { input: './global.css' });
