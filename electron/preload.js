/**
 * Preload script — runs before the web page loads
 * Intercepts window.print() for silent printing
 */
const { contextBridge, ipcRenderer } = require("electron");

// ============================================
// Expose Electron API to the web page
// ============================================
contextBridge.exposeInMainWorld("electronAPI", {
  // Check if running inside Electron
  isElectron: true,

  // Silent print (no dialog)
  silentPrint: () => ipcRenderer.send("silent-print"),

  // Get app version
  getVersion: () => ipcRenderer.invoke("get-version"),
});

// ============================================
// Intercept window.print() → silent print
// ============================================
window.addEventListener("DOMContentLoaded", () => {
  // Override the native print function
  const originalPrint = window.print;

  window.print = function () {
    // Send message to Electron main process for silent printing
    ipcRenderer.send("silent-print");
  };
});
