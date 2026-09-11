const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../');

const config = getDefaultConfig(projectRoot);

// ── Monorepo & Performance Optimizations ────────────────────────────────────
// Narrow watch folders specifically to packages and node_modules so Metro does
// not crawl backend/, .git/, .pnpm-store/, docs/, or temporary folders.
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
  unstable_enableSymlinks: true,
  // Ignore backend, git, design documents, and temporary files from bundling
  blockList: [
    /.*[/\\]backend[/\\].*/,
    /.*[/\\]\.git[/\\].*/,
    /.*[/\\]\.pnpm-store[/\\].*/,
    /.*[/\\]Bulao_design[/\\].*/,
    /.*[/\\]docs[/\\].*/,
  ],
};
// ────────────────────────────────────────────────────────────────────────────

module.exports = withNativeWind(config, { input: './global.css' });
