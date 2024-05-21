import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import scss from 'rollup-plugin-scss';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import typescript from '@rollup/plugin-typescript';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/js/index.ts',

  output: [
    {
      file: 'dist/picktime.min.js',
      format: 'es',
    },
    {
      file: 'dist/picktime.umd.js',
      format: 'umd',
      name: 'PickTime',
    },
  ],

  plugins: [
    scss({
      fileName: 'picktime.min.css',
      processor: () => postcss([autoprefixer]),
      outputStyle: 'compressed',
      watch: ['src/scss'],
      include: ['src/scss/**'],
      exclude: ['node_modules/**'],
    }),
    babel({
      extensions: ['.ts'],
      babelHelpers: 'bundled',
      presets: ['@babel/preset-typescript'],
      exclude: ['node_modules/**'],
    }),
    resolve(),
    commonjs(),
    terser(),
    typescript({ noForceEmit: true }),
  ],
};
