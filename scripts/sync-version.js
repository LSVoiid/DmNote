const fs = require("fs");
const path = require("path");

const pkgPath = path.resolve(__dirname, "../package.json");
const tauriConfPath = path.resolve(__dirname, "../src-tauri/tauri.conf.json");
const cargoTomlPath = path.resolve(__dirname, "../src-tauri/Cargo.toml");

const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const version = pkg.version;

console.log(`Syncing version to ${version}...`);

// 1. Update tauri.conf.json
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, "utf8"));
  tauriConf.version = version;
  fs.writeFileSync(tauriConfPath, JSON.stringify(tauriConf, null, 2) + "\n");
  console.log("Updated tauri.conf.json");
}

// 2. Update Cargo.toml
if (fs.existsSync(cargoTomlPath)) {
  let cargoToml = fs.readFileSync(cargoTomlPath, "utf8");
  cargoToml = cargoToml.replace(/^version = ".*"$/m, `version = "${version}"`);
  fs.writeFileSync(cargoTomlPath, cargoToml);
  console.log("Updated Cargo.toml");
}

console.log("Done!");
