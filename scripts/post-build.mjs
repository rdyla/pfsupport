import { mkdirSync, renameSync, copyFileSync } from "fs";

const clientDir = "dist/client";
const portalDir = `${clientDir}/portal`;

// Move the Vite-generated SPA shell and assets under /portal/
mkdirSync(portalDir, { recursive: true });
renameSync(`${clientDir}/index.html`, `${portalDir}/index.html`);
renameSync(`${clientDir}/assets`, `${portalDir}/assets`);

// Place the public welcome page at the root as index.html
copyFileSync(`public/welcome.html`, `${clientDir}/index.html`);

console.log("post-build: portal assets moved to dist/client/portal/");
console.log("post-build: welcome.html placed at dist/client/index.html");
