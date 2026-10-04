// Overlaya Studio: desktop app window
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");
const path = require("path");
const { startServer } = require("./server");

const PORT = 21510;
let win = null, server = null, quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on("second-instance", () => { if (win){ if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });

app.whenReady().then(async () => {
  try {
    server = await startServer({ port: PORT, dataDir: app.getPath("userData"), htmlPath: path.join(__dirname, "overlaya.html") });
  } catch (e){
    dialog.showErrorBox("Overlaya Studio", "Overlaya Studio couldn't start because port " + PORT + " is already in use. Close any other copy of Overlaya Studio and try again.");
    app.quit(); return;
  }
  Menu.setApplicationMenu(null);
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1000, minHeight: 640,
    backgroundColor: "#1C1816", title: "Overlaya Studio", autoHideMenuBar: true,
    icon: path.join(__dirname, "icon.png"),
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.loadURL("http://127.0.0.1:" + PORT + "/studio");
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.on("close", e => {
    if (quitting) return;
    const choice = dialog.showMessageBoxSync(win, {
      type: "question", buttons: ["Minimize", "Quit"], defaultId: 0, cancelId: 0,
      title: "Overlaya Studio",
      message: "Keep Overlaya Studio running?",
      detail: "Your overlays only work while Overlaya Studio is open. Minimize it while you're live.",
    });
    if (choice === 0){ e.preventDefault(); win.minimize(); }
    else quitting = true;
  });
});

app.on("before-quit", () => { quitting = true; if (server) server.close(); });
app.on("window-all-closed", () => app.quit());
