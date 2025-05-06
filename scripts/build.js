// build.js
const esbuild = require('esbuild');

Promise.all([
  esbuild.build({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.min.mjs',
    bundle: true,
    minify: true,
    sourcemap: true,
    format: 'esm',
    platform: 'neutral',
    target: ['es2022']
  }),
  esbuild.build({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.min.cjs',
    bundle: true,
    minify: true,
    sourcemap: true,
    format: 'cjs',
    platform: 'node',
    target: ['es2022']
  }),
])
  .then(() => console.log('Build complete.'))
  .catch(() => process.exit(1));