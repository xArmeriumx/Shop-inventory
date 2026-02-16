/**
 * Simple JSON store for persisting window state
 * Saves to: %APPDATA%/shop-inventory/window-state.json
 */
const fs = require("fs");
const path = require("path");
const { app } = require("electron");

class WindowStore {
  constructor() {
    const userDataPath = app.getPath("userData");
    this.filePath = path.join(userDataPath, "window-state.json");
    this.data = this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, "utf-8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.log("[Store] Failed to load state, using defaults");
    }
    return {};
  }

  save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.log("[Store] Failed to save state:", err.message);
    }
  }

  get(key, defaultValue) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this.save();
  }
}

module.exports = WindowStore;
