const {
  app,
  BrowserWindow,
  shell,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
  ipcMain,
} = require("electron");
const path = require("path");
const { net } = require("electron");
const WindowStore = require("./store");

// ============================================
// Config
// ============================================
const APP_URL = "https://shop-inventory.napatdev.com";
const APP_NAME = "Shop Inventory";
const ICON_PATH = path.join(__dirname, "..", "public", "favicon.ico");
const IS_DEV = !app.isPackaged;

let mainWindow;
let splashWindow;
let tray = null;
let isQuitting = false;
let store;

// ============================================
// 1. Single Instance Lock
// ============================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Another instance is already running — quit this one
  app.quit();
} else {
  // Someone tried to open a second instance — focus existing window
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ============================================
// Splash Screen
// ============================================
function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 340,
    frame: false,
    transparent: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: "#09090b",
    icon: ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  splashWindow.loadFile(path.join(__dirname, "splash.html"));
  splashWindow.center();
}

// ============================================
// 3. Remember Window Size/Position
// ============================================
function getWindowBounds() {
  const defaults = { width: 1400, height: 900 };
  const saved = store.get("windowBounds", null);

  if (saved && saved.width && saved.height) {
    return {
      x: saved.x,
      y: saved.y,
      width: Math.max(saved.width, 800),
      height: Math.max(saved.height, 600),
    };
  }
  return defaults;
}

function saveWindowBounds() {
  if (mainWindow && !mainWindow.isMinimized() && !mainWindow.isMaximized()) {
    const bounds = mainWindow.getBounds();
    store.set("windowBounds", bounds);
  }
  // Also save maximized state
  if (mainWindow) {
    store.set("isMaximized", mainWindow.isMaximized());
  }
}

// ============================================
// Main Window
// ============================================
function createWindow() {
  const bounds = getWindowBounds();

  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 800,
    minHeight: 600,
    title: APP_NAME,
    icon: ICON_PATH,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"), // Silent Print intercept
      // 6. Security Hardening
      sandbox: true,
      webviewTag: false,
    },
    backgroundColor: "#09090b",
    show: false,
    autoHideMenuBar: true,
  });

  // Restore maximized state
  if (store.get("isMaximized", false)) {
    mainWindow.maximize();
  }

  // --- Load the app (with offline fallback) ---
  loadAppWithFallback();

  // --- Show main window when ready & close splash ---
  mainWindow.once("ready-to-show", () => {
    setTimeout(() => {
      mainWindow.show();
      if (splashWindow && !splashWindow.isDestroyed()) {
        splashWindow.close();
        splashWindow = null;
      }
    }, 300);
  });

  // --- Save window bounds on resize/move ---
  mainWindow.on("resize", saveWindowBounds);
  mainWindow.on("move", saveWindowBounds);

  // --- Update title based on current page ---
  mainWindow.webContents.on("page-title-updated", (event, title) => {
    if (title && !title.includes(APP_NAME)) {
      mainWindow.setTitle(`${title} — ${APP_NAME}`);
    }
  });

  // --- Open external links in default browser ---
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(APP_URL)) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  // --- 6. Security: Block navigation to external sites ---
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(APP_URL)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // --- Handle page load errors (offline fallback) ---
  mainWindow.webContents.on(
    "did-fail-load",
    (event, errorCode, errorDesc, validatedURL) => {
      if (errorCode !== -3 && validatedURL.startsWith(APP_URL)) {
        console.log(
          `[Offline] Load failed (${errorCode}: ${errorDesc}), showing offline page`,
        );
        mainWindow.loadFile(path.join(__dirname, "offline.html"));
      }
    },
  );

  // --- System Tray: minimize to tray on close ---
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      if (tray && !app._trayNotified) {
        tray.displayBalloon({
          title: APP_NAME,
          content: "แอปยังทำงานอยู่ที่ถาดระบบ\nคลิกขวาเพื่อเปิดหรือปิดแอป",
          iconType: "info",
        });
        app._trayNotified = true;
      }
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ============================================
// Load app with offline detection
// ============================================
function loadAppWithFallback() {
  checkConnection()
    .then((isOnline) => {
      if (isOnline) {
        mainWindow.loadURL(APP_URL);
      } else {
        console.log("[Offline] No internet, showing offline page");
        mainWindow.loadFile(path.join(__dirname, "offline.html"));
      }
    })
    .catch(() => {
      mainWindow.loadFile(path.join(__dirname, "offline.html"));
    });
}

function checkConnection() {
  return new Promise((resolve) => {
    const request = net.request({ method: "HEAD", url: APP_URL });
    request.on("response", () => resolve(true));
    request.on("error", () => resolve(false));
    setTimeout(() => resolve(false), 8000);
    request.end();
  });
}

// ============================================
// System Tray
// ============================================
function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH);
  tray = new Tray(icon.resize({ width: 16, height: 16 }));

  const contextMenu = Menu.buildFromTemplate([
    { label: `📦 ${APP_NAME}`, enabled: false },
    { type: "separator" },
    {
      label: "เปิดแอป",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: "โหลดใหม่",
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.loadURL(APP_URL);
        }
      },
    },
    { type: "separator" },
    {
      label: "ปิดแอป",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip(APP_NAME);
  tray.setContextMenu(contextMenu);

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ============================================
// 2. Keyboard Shortcuts
// ============================================
function registerShortcuts() {
  // F11 = Toggle Fullscreen (perfect for POS kiosk mode)
  globalShortcut.register("F11", () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
  });

  // Ctrl+R = Reload page
  globalShortcut.register("CommandOrControl+R", () => {
    if (mainWindow) {
      mainWindow.webContents.reload();
    }
  });

  // Ctrl+Shift+R = Hard reload (clear cache)
  globalShortcut.register("CommandOrControl+Shift+R", () => {
    if (mainWindow) {
      mainWindow.webContents.reloadIgnoringCache();
    }
  });

  // Ctrl+Shift+I = DevTools (DEV MODE ONLY)
  if (IS_DEV) {
    globalShortcut.register("CommandOrControl+Shift+I", () => {
      if (mainWindow) {
        mainWindow.webContents.toggleDevTools();
      }
    });
  }

  // Escape = Exit fullscreen
  globalShortcut.register("Escape", () => {
    if (mainWindow && mainWindow.isFullScreen()) {
      mainWindow.setFullScreen(false);
    }
  });
}

// ============================================
// 4. Silent Print (IPC handler)
// ============================================
function registerIPCHandlers() {
  // Silent print — no dialog, goes directly to default printer
  ipcMain.on("silent-print", (event) => {
    if (mainWindow) {
      mainWindow.webContents.print(
        {
          silent: true, // Skip print dialog
          printBackground: true, // Include CSS backgrounds (important for receipts)
          margins: { marginType: "none" },
        },
        (success, failureReason) => {
          if (!success) {
            console.log("[Print] Failed:", failureReason);
            // Fallback: show print dialog if silent print fails
            mainWindow.webContents.print({
              silent: false,
              printBackground: true,
            });
          } else {
            console.log("[Print] Printed successfully (silent)");
          }
        },
      );
    }
  });

  // Get app version
  ipcMain.handle("get-version", () => {
    return app.getVersion();
  });
}

// ============================================
// App lifecycle
// ============================================
app.whenReady().then(() => {
  // Initialize store for window state
  store = new WindowStore();

  // 1. Show splash screen immediately
  createSplashWindow();

  // 2. Create system tray
  createTray();

  // 3. Register keyboard shortcuts
  registerShortcuts();

  // 4. Register IPC handlers (silent print, etc.)
  registerIPCHandlers();

  // 5. Create main window (loads in background)
  createWindow();
});

app.on("before-quit", () => {
  isQuitting = true;
});

app.on("will-quit", () => {
  // Unregister all shortcuts
  globalShortcut.unregisterAll();
});

app.on("window-all-closed", () => {
  if (isQuitting) {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});
