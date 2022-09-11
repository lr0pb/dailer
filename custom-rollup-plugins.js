import fg from 'fast-glob'
import * as fs from 'fs'

const isDev = process.env.DEV ? true : false;

export function cleaner(dir) {
  return {
    name: 'cleaner',
    buildStart() {
      const files = fg.sync(`./${dir}/**/*`);
      for (let file of files) fs.unlinkSync(file);
    }
  };
}

export function renameCopiedFiles(srcDir, dir, name, ext, path) { // used by rollup-plugin-copy
  const folder = path.match(/[\w]+(?=\/[\w\d.-]+$)/)[0];
  return `./${dir}${folder !== srcDir ? `/${folder}` : ''}/${name}.${ext}`;
}

export function generateFilesList(dir) {
  return {
    name: 'generateFilesList',
    writeBundle() {
      const files = fg
        .sync([
          `./${dir}/**/*`, `!./${dir}/index.html`, `!./${dir}/**/*.png`, `!./${dir}/**/*.jpg`
        ])
        .map((file) => file.replace(`/${dir}`, ''));
      files.push('./');
      const data = JSON.stringify(files);
      fs.writeFileSync(`./${dir}/files.json`, data);
    }
  };
}

export function insertEnvVariables(dir) {
  return {
    name: 'insertEnvVariables',
    writeBundle() {
      const fileName = `./${dir}/app.js`;
      const version = process.env.npm_package_version;
      console.log(isDev);
      const file = fs
        .readFileSync(fileName, 'utf8')
        .replace('{VERSION}', `${version}${isDev ? '-dev' : ''}`)
        .replace(`'{IS_DEV}'`, isDev);
      fs.writeFileSync(fileName, file);
    }
  };
}
