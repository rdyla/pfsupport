import { mkdirSync, renameSync } from "fs";

const clientDir = "dist/client";
const portalDir = `${clientDir}/portal`;

// Move the Vite-generated SPA shell and assets under /portal/
mkdirSync(portalDir, { recursive: true });
renameSync(`${clientDir}/index.html`, `${portalDir}/index.html`);
renameSync(`${clientDir}/assets`, `${portalDir}/assets`);

// Note: no index.html is placed at the site root. With no matching asset there,
// the Worker's "/" handler runs and redirects visitors straight into the portal
// (see src/worker/index.ts). The migration page remains available at /welcome
// (served from the public welcome.html that Vite copies into dist/client).

console.log("post-build: portal assets moved to dist/client/portal/");
