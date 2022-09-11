import {
  cleaner, renameCopiedFiles, generateFilesList, insertEnvVariables
} from './custom-rollup-plugins.js'
//import { nodeResolve } from '@rollup/plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import copy from 'rollup-plugin-copy'
import serve from 'rollup-plugin-serve'
import livereload from 'rollup-plugin-livereload'
//import css from 'rollup-plugin-css-porter'
import fg from 'fast-glob'

const isServe = process.env.SERVE;
const isDev = process.env.DEV;

const mainPlugins = [
  cleaner('out'),
  copy({
    targets: [{
      src: fg.sync(['./src/**/*', '!./src/**/*.js']),
      dest: './', rename: (...args) => renameCopiedFiles('src', 'out', ...args)
    }],
    flatten: true
  }),
  generateFilesList('out'),
  insertEnvVariables('out'),
];
const workerPlugins = [];

if (isServe) {
  mainPlugins.push(serve({
    contentBase: 'out', open: true,
    host: 'localhost', port: 4444
  }));
}
if (isDev) {
  mainPlugins.push(livereload({
    watch: './out', delay: 250
  }));
} else {
  mainPlugins.push(terser());
  workerPlugins.push(terser());
}

export default [{
  input: './src/app.js',
  output: [{
    file: './out/app.js',
    format: 'es'
  }],
  plugins: mainPlugins
}, {
  input: './src/sw.js',
  output: [{
    file: './out/sw.js',
    format: 'es'
  }],
  plugins: workerPlugins
}, {
  input: './src/workers/mainWorker.js',
  output: [{
    file: './out/workers/mainWorker.js',
    format: 'es'
  }],
  plugins: workerPlugins
}];
