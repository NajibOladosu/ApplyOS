const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, '../public/icons');

if (!fs.existsSync(iconDir)) {
    fs.mkdirSync(iconDir, { recursive: true });
}

// Simple blue square PNG (base64)
const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPj/HwADBwIAMCbHYQAAAABJRU5ErkJggg==', 'base64');

['icon-16.png', 'icon-48.png', 'icon-128.png'].forEach(file => {
    fs.writeFileSync(path.join(iconDir, file), pngData);
    console.log(`Created ${file}`);
});
