const fs = require("fs");
const path = require("path");

const repo = "/EventCreator";
const file = path.join(__dirname, "..", "dist", "index.html");

let html = fs.readFileSync(file, "utf8");

// Patch root-relative Expo web bundle paths
html = html.replace(/src="\/_expo\//g, `src="${repo}/_expo/`);
html = html.replace(/href="\/_expo\//g, `href="${repo}/_expo/`);

// Patch assets if they appear root-relative
html = html.replace(/src="\/assets\//g, `src="${repo}/assets/`);
html = html.replace(/href="\/assets\//g, `href="${repo}/assets/`);

fs.writeFileSync(file, html);
console.log("Patched dist/index.html for GitHub Pages base path:", repo);