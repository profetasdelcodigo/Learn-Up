const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'src/app/chat/page.tsx');
let pageContent = fs.readFileSync(pagePath, 'utf8');

const bgRegex = /className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-\[\'\/grid-pattern\.svg\'\] bg-opacity-5"/g;

pageContent = pageContent.replace(
  bgRegex,
  'className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#0b141a] bg-[url(\'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png\')] bg-cover bg-fixed bg-center"'
);

fs.writeFileSync(pagePath, pageContent);

console.log("UI updated 3!");
