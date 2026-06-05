const fs = require('fs');
const path = require('path');

const pagePath = path.join(__dirname, 'src/app/chat/page.tsx');
let pageContent = fs.readFileSync(pagePath, 'utf8');

// 1. Change the chat background to a dark whatsapp look
pageContent = pageContent.replace(
  /className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-\[\'\/grid-pattern\.svg\'\] bg-opacity-5"/,
  'className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#0b141a] bg-[url(\'https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png\')] bg-cover bg-fixed bg-center"'
);

// 2. Wrap messages with motion.div
pageContent = pageContent.replace(
  /<div\s+key=\{msg\.id\}\s+className=\{`flex items-end gap-2 \$\{isMe \? "justify-end" : "justify-start"\} group animate-in slide-in-from-bottom-2 duration-300`\}\s+>/g,
  `<motion.div
                            initial={{ opacity: 0, y: 15, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            key={msg.id}
                            className={\`flex items-end gap-2 \${isMe ? "justify-end" : "justify-start"} group\`}
                          >`
);
pageContent = pageContent.replace(
  /<\/div>\s*\{\/\* Modals \*\/\}/,
  `</motion.div>\n            {/* Modals */}`
);

// We need to carefully replace the ending </div> of the message container.
// Actually, let's just replace the exact message bubble classes.
pageContent = pageContent.replace(
  /className=\{`max-w-\[85%\] md:max-w-\[70%\] p-3 pb-6 shadow-sm relative flex flex-col gap-1 \$\{\n\s*isMe\n\s*\? "bg-brand-blue-glow\/20 text-white rounded-2xl rounded-tr-sm border border-brand-blue-glow\/30 shadow-\[0_0_15px_-5px_var\(--brand-blue-glow\)]"\n\s*: "bg-surface-2\/80 backdrop-blur-sm text-white rounded-2xl rounded-tl-sm border border-white\/6"\n\s*\}`\}/g,
  `className={\`max-w-[85%] md:max-w-[70%] p-2 pb-5 relative flex flex-col gap-1 \${
                                isMe
                                  ? "bg-[#005c4b]/95 backdrop-blur-md text-white rounded-2xl rounded-tr-md border border-white/5 shadow-md"
                                  : "bg-[#202c33]/95 backdrop-blur-md text-white rounded-2xl rounded-tl-md border border-white/5 shadow-md"
                              }\`}`
);

// Fix the closing div for motion.div
pageContent = pageContent.replace(
  /<\/div>\n\s*\{\/\* Input Area \*\/\}/,
  `</motion.div>\n                      {/* Input Area */}`
);

// Wait, the motion.div replaces the `<div key={msg.id}` so its closing tag is before `}`
pageContent = pageContent.replace(
  /<\/div>\n\s*\);\n\s*\}\)\}\n\s*<div ref=\{messagesEndRef\} \/>/g,
  `</motion.div>\n                        );\n                      })}\n                      <div ref={messagesEndRef} />`
);

// 3. Update CheckCheck icon for read receipts
pageContent = pageContent.replace(
  /\{isMe && <CheckCheck className="w-3\.5 h-3\.5 text-brand-blue-glow ml-0\.5" \/>\}/g,
  `{isMe && <CheckCheck className="w-4 h-4 text-[#53bdeb] ml-0.5" />}`
);

// 4. Update the input area to floating WhatsApp style
pageContent = pageContent.replace(
  /className="relative flex items-end gap-2 bg-surface-2\/50 p-2 rounded-2xl border border-white\/6 focus-within:border-brand-gold\/50 transition-colors"/g,
  `className="relative flex items-end gap-2 bg-[#202c33] p-1.5 rounded-full border border-white/10 shadow-lg transition-colors"`
);
pageContent = pageContent.replace(
  /className="p-3 bg-brand-blue-glow\/20 text-brand-blue-glow rounded-xl hover:bg-brand-blue-glow hover:text-white border border-brand-blue-glow\/30 shadow-\[0_0_15px_-5px_var\(--brand-blue-glow\)\] transition-all disabled:opacity-50 disabled:shadow-none disabled:bg-surface-2 disabled:border-white\/6 disabled:text-gray-500"/g,
  `className="p-3.5 bg-[#00a884] text-white rounded-full hover:bg-[#008f6f] shadow-lg transition-transform hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"`
);


// Rewrite page.tsx
fs.writeFileSync(pagePath, pageContent);

// ----------------------------------------------------
// VideoRoom.tsx updates
// ----------------------------------------------------
const videoRoomPath = path.join(__dirname, 'src/components/VideoRoom.tsx');
let videoContent = fs.readFileSync(videoRoomPath, 'utf8');

// Convert buttons to floating minimalist controls with glassmorphism
videoContent = videoContent.replace(
  /className="flex items-center gap-1 px-3 py-1\.5 bg-zinc-900 border-b border-brand-gold\/10 shrink-0"/g,
  `className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full shrink-0 z-50 shadow-2xl"`
);

// Adjust ParticipantTileCard borders and styles for soft edges
videoContent = videoContent.replace(
  /className=\{`relative shrink-0 rounded-xl overflow-hidden border-2 transition-all duration-200 bg-brand-black \$\{\n\s*isSpeaking\n\s*\? "border-brand-gold shadow-\[0_0_16px_rgba\(212,175,55,0\.6\)\]"\n\s*: "border-white\/6"\n\s*\}`\}/g,
  `className={\`relative shrink-0 rounded-3xl overflow-hidden border transition-all duration-300 bg-zinc-900 \${
        isSpeaking
          ? "border-[#00a884] shadow-[0_0_20px_rgba(0,168,132,0.4)]"
          : "border-white/10"
      }\`}`
);

// Update status bar for ParticipantTileCard
videoContent = videoContent.replace(
  /className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-1\.5 py-1 bg-linear-to-t from-black\/80 to-transparent"/g,
  `className="absolute bottom-2 left-2 right-2 flex items-center justify-between px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10"`
);

fs.writeFileSync(videoRoomPath, videoContent);

console.log("UI updated!");
