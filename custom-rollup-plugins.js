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

// for rollup-plugin-copy
export function renameCopiedFiles(srcDir, dir, name, ext, path) {
  const folders = path.match(/(?<=\/)[\w\d.-]+(?=\/)/g);
  
  return `./${dir}${ext == 'scss' ? `/${srcDir}${
    name !== 'app' && folders[1] !== folders.at(-1) ? `/${folders[1]}` : ''
  }`: ''}${
    folders.at(-1) !== srcDir ? `/${folders.at(-1)}` : ''
  }/${name}.${ext}`;
}

export function copyJSONs(srcDir, dir) {
  return {
    name: 'copyJSONs',
    writeBundle() {
      const files = fg.sync(`./${srcDir}/**/*.json`);
      for (let path of files) {
        const data = fs.readFileSync(path, 'utf8');
        const outPath = path.replace(srcDir, dir);
        const converted = JSON.stringify(JSON.parse(data));
        fs.writeFileSync(outPath, converted);
      }
    }
  };
}

export function generateFilesList(dir) {
  return {
    name: 'generateFilesList',
    writeBundle() {
      const files = fg
        .sync([
          `./${dir}/**/*`, `!./${dir}/index.html`, `!./${dir}/sw.js`,
          `!./${dir}/**/*.png`, `!./${dir}/**/*.jpg`
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
        .replace(`'{IS_DEV}'`, isDev)
        .replace(`{MIGRATION_DAY}`, 1668981600000); // 21.11.2022
      fs.writeFileSync(fileName, file);
    }
  };
}
