const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const Dotenv = require('dotenv-webpack');

module.exports = (env, argv) => {
    const browser = env.browser || 'chrome';

    return {
        mode: (argv && argv.mode) || process.env.NODE_ENV || 'production',
        // NOTE: dotenv-webpack below reads the REPO ROOT .env.local, which holds
        // SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY and DKIM_PRIVATE_KEY. Only
        // NEXT_PUBLIC_* values are referenced today, but nothing structurally
        // prevents a future process.env.SUPABASE_SERVICE_ROLE_KEY reference from
        // being inlined verbatim into a world-readable bundle. scripts/check-secrets.sh
        // gates the build on exactly that.
        entry: {
            background: './src/background/service-worker.ts',
            content: './src/content/index.tsx',
            // No MAIN-world bundle. Framework-native writes go through
            // chrome.scripting.executeScript({ world: 'MAIN', func, args }) from the
            // service worker: Chrome serialises the function rather than fetching it,
            // so there is no web_accessible_resources entry, no page-CSP exposure, and
            // no long-lived postMessage channel whose nonce the page could read.
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
                '@': path.resolve(__dirname, 'src'),
                // shared/autofill is the jsdom-testable pure core. It is outside this
                // package on purpose: vitest.unit.config.ts:11-15 covers shared/** and
                // modules/**, and extension/** is in no test or lint glob.
                '@shared': path.resolve(__dirname, '../shared')
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
            // Was `process.env.NODE_ENV === 'production'`, which npm run build never
            // sets — it passes --mode production. Nothing was minified and
            // dist/chrome/popup.js shipped at 2.3MB, which also reads as scope creep
            // in Chrome Web Store review.
            minimize: (argv && argv.mode ? argv.mode : process.env.NODE_ENV) === 'production'
        },
        devtool: process.env.NODE_ENV === 'development' ? 'inline-source-map' : false
    };
};
