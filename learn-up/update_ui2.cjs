const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'src/app/chat/page.tsx');
let pageContent = fs.readFileSync(pagePath, 'utf8');

// 1. Background
pageContent = pageContent.replace(
  /className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-\[\'\/grid-pattern\.svg\'\] bg-opacity-5"/g,
  'className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#0b141a] bg-[url(\'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png\')] bg-cover bg-fixed bg-center"'
);

// 2. Chat bubbles (with regex to ignore whitespace variations)
const bubbleRegex = /className=\{`max-w-\[85%\] md:max-w-\[70%\] p-3 pb-6 shadow-sm relative flex flex-col gap-1 \$\{\s*isMe\s*\? "bg-brand-blue-glow\/20 text-white rounded-2xl rounded-tr-sm border border-brand-blue-glow\/30 shadow-\[0_0_15px_-5px_var\(--brand-blue-glow\)\]"\s*: "bg-surface-2\/80 backdrop-blur-sm text-white rounded-2xl rounded-tl-sm border border-white\/6"\s*\}`\}/g;

pageContent = pageContent.replace(
  bubbleRegex,
  'className={`max-w-[85%] md:max-w-[70%] p-2 pb-5 relative flex flex-col gap-1 ${isMe ? "bg-[#005c4b]/95 backdrop-blur-md text-white rounded-2xl rounded-tr-md border border-[#005c4b] shadow-md" : "bg-[#202c33]/95 backdrop-blur-md text-white rounded-2xl rounded-tl-md border border-white/5 shadow-md"}`}'
);

fs.writeFileSync(pagePath, pageContent);

// ----------------------------------------------------
// VideoRoom.tsx updates
// ----------------------------------------------------
const videoRoomPath = path.join(__dirname, 'src/components/VideoRoom.tsx');
let videoContent = fs.readFileSync(videoRoomPath, 'utf8');

const tileRegex = /className=\{`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 bg-brand-black \$\{\s*isSpeaking\s*\? "border-brand-gold shadow-\[0_0_16px_rgba\(212,175,55,0\.6\)\]"\s*: "border-white\/6"\s*\}`\}/g;

videoContent = videoContent.replace(
  tileRegex,
  'className={`relative shrink-0 rounded-3xl overflow-hidden border transition-all duration-300 bg-zinc-900 ${isSpeaking ? "border-[#00a884] shadow-[0_0_20px_rgba(0,168,132,0.4)]" : "border-white/10"}`}'
);

fs.writeFileSync(videoRoomPath, videoContent);

console.log("UI updated 2!");
