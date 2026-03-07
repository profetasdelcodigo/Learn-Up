import fs from "fs";
import path from "path";

function walkDir(dir: string, callback: (path: string) => void) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach((f) => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(dirPath);
  });
}

walkDir("./src", (filePath) => {
  if (filePath.endsWith(".tsx") || filePath.endsWith(".ts")) {
    let content = fs.readFileSync(filePath, "utf8");
    let original = content;

    // Replacements
    content = content.replace(/\bflex-shrink-0\b/g, "shrink-0");
    content = content.replace(/\bbg-gradient-to-/g, "bg-linear-to-");
    content = content.replace(/aspect-\[4\/3\]/g, "aspect-4/3");
    content = content.replace(/h-\[100dvh\]/g, "h-dvh");
    content = content.replace(/z-\[60\]/g, "z-60");
    content = content.replace(/z-\[70\]/g, "z-70");
    content = content.replace(/z-\[80\]/g, "z-80");
    content = content.replace(/z-\[100\]/g, "z-100");
    content = content.replace(/\bbreak-words\b/g, "wrap-break-word");

    content = content.replace(/\binline-flex\s+flex\b/g, "flex");
    content = content.replace(/\bflex\s+inline-flex\b/g, "flex");

    if (content !== original) {
      fs.writeFileSync(filePath, content, "utf8");
      console.log(`Updated Tailwind classes in: ${filePath}`);
    }
  }
});
