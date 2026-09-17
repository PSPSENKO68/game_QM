const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const html = fs.readFileSync('admin.html', 'utf8');
const js = fs.readFileSync('admin.js', 'utf8');

// Strip out imports to avoid module resolution errors
const safeJs = js.replace(/import .* from .*;/g, '')
                 .replace(/export .*;/g, '')
                 .replace(/db\./g, '({}).');

const dom = new JSDOM(html, { runScripts: "dangerously" });
const window = dom.window;
const document = window.document;

try {
  // Execute the modified script within the JSDOM context
  const scriptEl = document.createElement("script");
  scriptEl.textContent = safeJs;
  document.body.appendChild(scriptEl);

  // Dispatch DOMContentLoaded to trigger the initialization
  document.dispatchEvent(new window.Event('DOMContentLoaded'));

  if (window.startLuckyDrawGlobal) {
    console.log("SUCCESS: window.startLuckyDrawGlobal is defined!");
  } else {
    console.log("FAILURE: window.startLuckyDrawGlobal is undefined but no error was thrown?");
  }
} catch (e) {
  console.log("ERROR THROWN:", e);
}
