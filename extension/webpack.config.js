const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

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
                    use: [
                        'style-loader',
                        // `/fonts/*.woff2` must survive as a literal URL: at runtime
                        // popup.html sits at the extension root, so that path resolves
                        // to chrome-extension://<id>/fonts/..., which CopyPlugin fills.
                        // Without this filter css-loader resolves it as a module at
                        // build time and the build fails.
                        {
                            loader: 'css-loader',
                            options: {
                                url: {
                                    filter: (url) => !url.startsWith('/fonts/')
                                }
                            }
                        },
                        'postcss-loader'
                    ]
                }
            ]
        },
        resolve: {
            extensions: ['.tsx', '.ts', '.js'],
            alias: {
                '@': path.resolve(__dirname, 'src')
            },
            fallback: {
                "process": false
            }
        },
        plugins: [
            new CopyPlugin({
                patterns: [
                    {
                        from: path.resolve(__dirname, 'manifest.json'),
                        to: 'manifest.json'
                    },
                    // public/ carries icons and the self-hosted woff2 files that
                    // globals.css references at /fonts/*.
                    { from: 'public', to: '.' },
                    { from: 'src/popup/index.html', to: 'popup.html' },
                    { from: 'src/options/index.html', to: 'options.html' }
                ]
            }),
            new Dotenv({
                path: path.resolve(__dirname, '../.env.local'), // Path to .env file
                systemvars: true, // load system variables as well
                safe: false
            })
        ],
        optimization: {
            minimize: process.env.NODE_ENV === 'production'
        },
        devtool: process.env.NODE_ENV === 'development' ? 'inline-source-map' : false
    };
};
