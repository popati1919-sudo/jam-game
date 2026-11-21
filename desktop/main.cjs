const { app, BrowserWindow, net, protocol, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const home = "bloom://game/index.html";
const gameDirectory = path.join(__dirname, "game");
const licenses = new Set(["bloom://game/fonts/OFL-DM-Sans.txt", "bloom://game/fonts/OFL-Young-Serif.txt"]);
const jam = "https://itch.io/jam/cityjam";
const secureRenderer = { sandbox: true, nodeIntegration: false, contextIsolation: true };

protocol.registerSchemesAsPrivileged([{
  scheme: "bloom",
  privileges: { standard: true, secure: true, supportFetchAPI: true }
}]);

function openLink(parent, address) {
  if (address === jam) {
    shell.openExternal(jam).catch(console.error);
  } else if (licenses.has(address)) {
    const license = new BrowserWindow({
      parent, width: 760, height: 580, title: "Font license",
      autoHideMenuBar: true, webPreferences: secureRenderer
    });
    license.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    license.webContents.on("will-navigate", event => event.preventDefault());
    license.loadURL(address);
  }
}

app.whenReady().then(() => {
  // A stable origin keeps each player's saved gardens across portable launches.
  protocol.handle("bloom", request => {
    const address = new URL(request.url);
    const names = address.pathname.slice(1).split("/");
    if (address.host !== "game" || names.some(name => !/^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(name))) {
      return new Response("Not found", {status: 404});
    }
    return net.fetch(pathToFileURL(path.join(gameDirectory, ...names)).href);
  });

  const window = new BrowserWindow({
    title: "Rooftops in Bloom", width: 1140, height: 820, minWidth: 400, minHeight: 450,
    backgroundColor: "#f5f1e6", show: false, autoHideMenuBar: true, webPreferences: secureRenderer
  });
  window.removeMenu();
  window.webContents.setWindowOpenHandler(({ url }) => {
    openLink(window, url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    event.preventDefault();
    openLink(window, url);
  });
  window.webContents.on("dom-ready", () => {
    window.webContents.insertCSS(".desktop-download{display:none!important}");
  });
  window.once("ready-to-show", () => window.show());
  window.loadURL(home);
});
app.on("window-all-closed", () => app.quit());
