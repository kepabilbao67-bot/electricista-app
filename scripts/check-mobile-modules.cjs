// Static navigation and mobile UX regression: no server, no DB, no credentials.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = rel => fs.readFileSync(path.join(__dirname,"..",rel),"utf8");
const nav=read("src/components/MobileNav.tsx");
const layout=read("src/app/layout.tsx");
const docs=read("src/app/documentos/page.tsx");
const measure=read("src/app/mediciones/page.tsx");
const falt=read("src/app/faltantes/page.tsx");
const routes=["/faltantes","/documentos","/mediciones"];
for(const route of routes){
 assert.ok(layout.includes('href: "'+route+'"'),"Missing navigation route "+route);
 assert.ok(nav.includes('href: "'+route+'"'),"Missing mobile shortcut "+route);
 assert.ok(fs.existsSync(path.join(__dirname,"..","src/app",route.substring(1),"page.tsx")),"Missing page "+route);
}
assert.match(nav,/grid-cols-3/,"Mobile shortcuts must not require horizontal scrolling");
assert.match(nav,/min-h-12/,"Shortcuts need touch sized targets");
assert.match(docs,/href="\/documentos360\/index\.html"/);
assert.match(docs,/md:hidden/,"Full screen document entry for mobile");
assert.match(measure,/useState\("mm"\)/,"Default mm unit");
assert.match(measure,/touch-none/,"Photo mark must not scroll page");
assert.match(measure,/type="file" accept="image\/\*"/,"Photo chooser");
assert.match(falt,/localStorage\.setItem/,"Faltantes local persistence");
assert.match(falt,/https:\/\/wa\.me\/\?text=/,"User-triggered WhatsApp share");
console.log("MOBILE_STATIC_REGRESSION_PASS: 3 routes, mobile shortcuts, docs, measurements, faltantes.");
