//import { nodeResolve } from '@rollup/plugin-node-resolve'
import { terser } from 'rollup-plugin-terser'
import copy from 'rollup-plugin-copy'
//import brotli from 'rollup-plugin-brotli'
//import css from 'rollup-plugin-css-porter'
import fg from 'fast-glob'

const fs = require('fs');

export default [{
  input: './src/app.js',
  output: [{
    file: './out/app.js',
    format: 'es'
  }],
  plugins: [
    {
      name: 'cleaner',
      buildStart() {
        const files = fg.sync('./out/**/*');
        for (let file of files) fs.unlinkSync(file);
      }
    },
    terser({ compress: { ecma: 2019 } }),
    /*css({
      raw: false,
      minified: './dist/app.min.css'
    }),*/
    copy({
      targets: [{
        src: fg.sync(['./src/**/*', '!./src/**/*.js']),
        dest: './',
        rename: (name, ext, path) => {
          const folder = path.match(/[\w]+(?=\/[\w\d.-]+$)/)[0];
          return `./out${folder !== 'src' ? `/${folder}` : ''}/${name}.${ext}`;
        }
      }],
      flatten: true
    }),
    //brotli(),
  ]
}, {
  input: './src/sw.js',
  output: [{
    file: './out/sw.js',
    format: 'es'
  }],
  plugins: [
    terser({ compress: { ecma: 2019 } }),
    //brotli(),
  ]
}, {
  input: './src/workers/mainWorker.js',
  output: [{
    file: './out/workers/mainWorker.js',
    format: 'es'
  }],
  plugins: [
    terser({ compress: { ecma: 2019 } }),
    //brotli(),
  ]
}];
