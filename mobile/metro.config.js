const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../');

const config = getDefaultConfig(projectRoot);

// ── pnpm symlink / monorepo fix ─────────────────────────────────────────────
// Metro does not follow symlinks (junctions on Windows) by default.
// This tells Metro to watch the entire workspace node_modules so that
// packages installed by pnpm (e.g. react-native-maps) can be resolved.
config.watchFolders = [workspaceRoot];

config.resolver = {
  ...config.resolver,
  // Allow Metro to resolve modules from the workspace-level node_modules
  // (where pnpm actually stores the real package files)
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  // Follow symlinks (junctions) so pnpm-linked packages are resolved correctly
  unstable_enableSymlinks: true,
};
// ────────────────────────────────────────────────────────────────────────────

module.exports = withNativeWind(config, { input: './global.css' });
