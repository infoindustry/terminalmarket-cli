# TerminalMarket CLI binaries

This repo can be distributed in 2 ways:

1) **npm** (requires Node.js + npm)

```bash
npm i -g terminalmarket
```

2) **Standalone binary** (no Node/npm needed)

## Build binaries (maintainers)

```bash
npm ci
npm run build:bin
```

This produces binaries in `dist/`:
- `tm-linux-x64`
- `tm-macos-x64`
- `tm-macos-arm64`
- `tm-win-x64.exe` (if built with Windows target)

### Build for specific platform

```bash
npm run build:bin:linux    # Linux x64 only
npm run build:bin:macos    # macOS x64 + arm64
npm run build:bin:win      # Windows x64
```

## How it works

1. `esbuild` bundles `bin/tm.js` and all dependencies into a single `dist/tm.cjs` file
2. `pkg` compiles that bundle into standalone executables for each platform

## Publish binaries

### Option 1: GitHub Releases

1. Tag a release (e.g. `v0.7.3`)
2. Build binaries locally or via GitHub Actions
3. Upload binaries as release assets

### Option 2: Host on your server

1. Build binaries
2. Upload to your CDN/server (e.g. `https://terminalmarket.app/bin/`)
3. Update `install.sh` with correct URLs

## Install script

Place `install.sh` on your server. Users can install with:

```bash
curl -fsSL https://terminalmarket.app/install.sh | sh
```

The script:
1. Detects OS (Linux/macOS) and architecture (x64/arm64)
2. Downloads the correct binary
3. Installs to `~/.local/bin/tm`
4. Makes it executable

## Directory structure

```
cli/terminalmarket/
├── bin/
│   └── tm.js           # Main CLI entry point
├── src/
│   ├── api.js          # API client
│   ├── config.js       # Config management
│   └── format.js       # Output formatting
├── dist/               # Built binaries (gitignored)
│   ├── tm.cjs          # Bundled JS
│   ├── tm-linux-x64
│   ├── tm-macos-x64
│   └── tm-macos-arm64
├── package.json
├── README.md
└── INSTALL_BINARIES.md
```

## Troubleshooting

### "pkg" not found
```bash
npm install
```

### Binary too large
The binaries include Node.js runtime (~40-50MB). This is normal for standalone executables.

### macOS Gatekeeper warning
Users may need to allow the binary in System Preferences > Security & Privacy, or run:
```bash
xattr -d com.apple.quarantine ~/.local/bin/tm
```
