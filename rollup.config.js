import path from 'path';
import scss from 'rollup-plugin-scss';
import autoprefixer from 'autoprefixer';
import postcss from 'postcss';
import babel from '@rollup/plugin-babel';
import { terser } from 'rollup-plugin-terser';

export default {
  input: 'src/js/index.js',
  output: [
    {
      file: path.resolve('build/picktime.min.js'),
      format: 'cjs',
      exports: 'default',
    },
    {
      file: path.resolve('build/esm/picktime.min.js'),
      format: 'esm',
    },
    {
      file: path.resolve('build/umd/picktime.min.js'),
      format: 'umd',
      name: 'PickTime',
    },
  ],
  plugins: [
    scss({
      output: path.resolve('build/css/picktime.min.css'),
      processor: () => postcss([autoprefixer]),
      outputStyle: 'compressed',
    }),
    babel({
      babelHelpers: 'bundled',
      exclude: 'node_modules/**',
    }),
    terser(),
  ],
};
