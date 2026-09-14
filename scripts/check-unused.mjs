#!/usr/bin/env node
// Quick guard against unused lucide imports that break `next build` (eslint no-unused-vars = error)
import fs from "fs";
import path from "path";

const root = path.resolve("src");
let found = false;

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full);
    else if (ent.name.endsWith(".tsx") || ent.name.endsWith(".ts")) {
      const txt = fs.readFileSync(full, "utf8");
      const m = txt.match(/import\s*\{\s*([^}]+)\}\s*from\s*["']lucide-react["']/);
      if (!m) continue;
      const imports = m[1].split(",").map(s => s.trim()).filter(Boolean);
      const without = txt.replace(m[0], "");
      for (const imp of imports) {
        const alias = imp.includes(" as ") ? imp.split(" as ").pop().trim() : imp.split(" ")[0].trim();
        const re = new RegExp(`\\b${alias}\\b`);
        if (!re.test(without)) {
          console.error(`UNUSED: ${full} -> ${imp}`);
          found = true;
        }
      }
    }
  }
}

walk(root);
if (found) {
  console.error("\nFix unused imports above or build will fail.");
  process.exit(1);
} else {
  console.log("✓ No unused lucide-react imports found");
}
