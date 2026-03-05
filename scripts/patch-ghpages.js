const fs = require("fs");
const path = require("path");

const repo = "/EventCreator";
const distDir = path.join(__dirname, "..", "dist");
const indexFile = path.join(distDir, "index.html");

let html = fs.readFileSync(indexFile, "utf8");

// Fix any asset paths that weren't caught by publicPath (safety net).
// If publicPath is correctly set in app.json, these regexes are no-ops.
html = html.replace(/src="\/_expo\//g, `src="${repo}/_expo/`);
html = html.replace(/href="\/_expo\//g, `href="${repo}/_expo/`);
html = html.replace(/src="\/assets\//g, `src="${repo}/assets/`);
html = html.replace(/href="\/assets\//g, `href="${repo}/assets/`);

fs.writeFileSync(indexFile, html);
console.log("Patched dist/index.html for GitHub Pages base path:", repo);

// Copy index.html → 404.html so GitHub Pages serves the SPA shell for
// any deep route (e.g. /EventCreator/history/abc) that has no physical file.
// The Expo Router (with baseUrl set) will then handle the route client-side.
const notFoundFile = path.join(distDir, "404.html");
fs.copyFileSync(indexFile, notFoundFile);
console.log("Created dist/404.html (SPA fallback for GitHub Pages)");
