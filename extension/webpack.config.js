const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = (env) => {
    const browser = env.browser || 'chrome';

    return {
        mode: process.env.NODE_ENV || 'production',
        entry: {
            background: './src/background/service-worker.ts',
            content: './src/content/index.tsx',
            popup: './src/popup/index.tsx',
            options: './src/options/index.tsx'
        },
        output: {
            path: path.resolve(__dirname, `dist/${browser}`),
            filename: '[name].js',
            clean: true
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: 'ts-loader',
                    exclude: /node_modules/
                },
                {
                    test: /\.css$/,
                    use: ['style-loader', 'css-loader', 'postcss-loader']
                }
            ]
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
            alias: {
                '@': path.resolve(__dirname, 'src')
            }
        },
        plugins: [
            new CopyPlugin({
                patterns: [
                    {
                        from: 'manifest.json',
                        to: 'manifest.json',
                        transform(content) {
                            // Can modify manifest per browser if needed
                            return content;
                        }
                    },
                    { from: 'public', to: '.' },
                    { from: 'src/popup/index.html', to: 'popup.html' },
                    { from: 'src/options/index.html', to: 'options.html' }
                ]
            })
        ],
        optimization: {
            minimize: process.env.NODE_ENV === 'production'
        },
        devtool: process.env.NODE_ENV === 'development' ? 'inline-source-map' : false
    };
};
