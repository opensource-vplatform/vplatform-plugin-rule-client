import babel from "rollup-plugin-babel";
import { terser } from 'rollup-plugin-terser';
export default {
    input: './src/index.js',
    output: {
        file: './dist/index.js',
        format: 'umd',
        name: 'com.toone.v3.platform.rule.client.GenerateBillCode',
        sourcemap: false
    },
    plugins: [
        babel({
            runtimeHelpers: true
        }),
        terser()
    ]
};