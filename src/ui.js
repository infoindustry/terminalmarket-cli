/**
 * TerminalMarket UI Components
 * Beautiful, modern terminal interface
 */

import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import gradient from "gradient-string";
import figlet from "figlet";
import terminalLink from "terminal-link";

export const theme = {
  primary: chalk.hex("#00FF9F"),
  secondary: chalk.hex("#00D9FF"),
  accent: chalk.hex("#FF6B9D"),
  warning: chalk.hex("#FFE66D"),
  error: chalk.hex("#FF6B6B"),
  
  text: chalk.hex("#E8E8E8"),
  muted: chalk.hex("#6B7280"),
  dim: chalk.hex("#4B5563"),
  
  gradients: {
    brand: gradient(["#00FF9F", "#00D9FF", "#BD00FF"]),
    sunset: gradient(["#FF6B9D", "#FFE66D"]),
    ocean: gradient(["#00D9FF", "#00FF9F"]),
    fire: gradient(["#FF6B6B", "#FFE66D"]),
    purple: gradient(["#BD00FF", "#FF6B9D"]),
  },
  
  box: {
    primary: { borderStyle: "round", borderColor: "#00FF9F", padding: 1 },
    secondary: { borderStyle: "round", borderColor: "#00D9FF", padding: 1 },
    warning: { borderStyle: "round", borderColor: "#FFE66D", padding: 1 },
    error: { borderStyle: "round", borderColor: "#FF6B6B", padding: 1 },
    dimmed: { borderStyle: "round", borderColor: "#4B5563", padding: 1 },
  }
};

const LOGO_MINI = `
  ╔╦╗┌─┐┬─┐┌┬┐┬┌┐┌┌─┐┬  
   ║ ├┤ ├┬┘│││││││├─┤│  
   ╩ └─┘┴└─┴ ┴┴┘└┘┴ ┴┴─┘
  ╔╦╗┌─┐┬─┐┬┌─┌─┐┌┬┐
  ║║║├─┤├┬┘├┴┐├┤  │ 
  ╩ ╩┴ ┴┴└─┴ ┴└─┘ ┴ `;

const LOGO_LARGE = `
████████╗███████╗██████╗ ███╗   ███╗██╗███╗   ██╗ █████╗ ██╗     
╚══██╔══╝██╔════╝██╔══██╗████╗ ████║██║████╗  ██║██╔══██╗██║     
   ██║   █████╗  ██████╔╝██╔████╔██║██║██╔██╗ ██║███████║██║     
   ██║   ██╔══╝  ██╔══██╗██║╚██╔╝██║██║██║╚██╗██║██╔══██║██║     
   ██║   ███████╗██║  ██║██║ ╚═╝ ██║██║██║ ╚████║██║  ██║███████╗
   ╚═╝   ╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝  ╚═╝╚══════╝
███╗   ███╗ █████╗ ██████╗ ██╗  ██╗███████╗████████╗
████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝██╔════╝╚══██╔══╝
██╔████╔██║███████║██████╔╝█████╔╝ █████╗     ██║   
██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗ ██╔══╝     ██║   
██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗███████╗   ██║   
╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝   ╚═╝   `;

export const icons = {
  success: "✔",
  error: "✖",
  warning: "⚠",
  info: "ℹ",
  
  cart: "🛒",
  buy: "💳",
  search: "🔍",
  view: "👁",
  
  coffee: "☕",
  food: "🍽",
  health: "💆",
  cowork: "🏢",
  ai: "🤖",
  tools: "⚡",
  digital: "💾",
  
  arrow: "→",
  arrowRight: "▸",
  arrowDown: "▾",
  bullet: "●",
  circle: "○",
  star: "★",
  starEmpty: "☆",
  check: "✓",
  cross: "✗",
  dot: "·",
  line: "─",
  doubleLine: "═",
  
  sparkle: "✨",
  fire: "🔥",
  rocket: "🚀",
  gift: "🎁",
  crown: "👑",
  lightning: "⚡",
  heart: "❤",
  pin: "📍",
  globe: "🌍",
  flag: "🏳",
  package: "📦",
  money: "💰",
  credit: "💳",
  clock: "🕐",
  tag: "🏷",
};

const spinnerStyles = {
  default: {
    frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    interval: 80
  },
  dots: {
    frames: ["⣾", "⣽", "⣻", "⢿", "⡿", "⣟", "⣯", "⣷"],
    interval: 100
  },
  market: {
    frames: ["🛒 ", " 🛒", "  🛒", "   🛒", "  🛒", " 🛒"],
    interval: 150
  },
  pulse: {
    frames: ["█", "▓", "▒", "░", "▒", "▓"],
    interval: 120
  }
};

let currentSpinner = null;

export function createSpinner(text, style = "default") {
  const spinnerConfig = spinnerStyles[style] || spinnerStyles.default;
  currentSpinner = ora({
    text: theme.text(text),
    spinner: spinnerConfig,
    color: "cyan"
  }).start();
  return currentSpinner;
}

export function updateSpinner(text) {
  if (currentSpinner) {
    currentSpinner.text = theme.text(text);
  }
}

export function stopSpinner(success = true, text = null) {
  if (currentSpinner) {
    if (success) {
      currentSpinner.succeed(text ? theme.primary(text) : undefined);
    } else {
      currentSpinner.fail(text ? theme.error(text) : undefined);
    }
    currentSpinner = null;
  }
}

export function showBox(content, options = {}) {
  const defaultOptions = {
    padding: 1,
    margin: { top: 1, bottom: 1 },
    borderStyle: "round",
    borderColor: "#00FF9F",
  };
  
  console.log(boxen(content, { ...defaultOptions, ...options }));
}

export function showInfoBox(title, content) {
  const header = theme.secondary.bold(`${icons.info} ${title}`);
  const body = typeof content === "string" ? content : content.join("\n");
  
  showBox(`${header}\n\n${theme.text(body)}`, {
    borderColor: "#00D9FF",
    title: "",
    titleAlignment: "left"
  });
}

export function showSuccessBox(message) {
  showBox(theme.primary(`${icons.success} ${message}`), {
    borderColor: "#00FF9F",
    padding: { top: 0, bottom: 0, left: 2, right: 2 }
  });
}

export function showErrorBox(message) {
  showBox(theme.error(`${icons.error} ${message}`), {
    borderColor: "#FF6B6B",
    padding: { top: 0, bottom: 0, left: 2, right: 2 }
  });
}

export function showWarningBox(message) {
  showBox(theme.warning(`${icons.warning} ${message}`), {
    borderColor: "#FFE66D",
    padding: { top: 0, bottom: 0, left: 2, right: 2 }
  });
}

export function showWelcome(version) {
  const termWidth = process.stdout.columns || 80;
  const useSmallLogo = termWidth < 100;
  
  console.log();
  
  if (useSmallLogo) {
    console.log(theme.gradients.brand(LOGO_MINI));
  } else {
    console.log(theme.gradients.brand(LOGO_LARGE));
  }
  
  console.log();
  
  const tagline = "  The Marketplace for Developers";
  console.log(theme.muted(tagline));
  console.log();
  
  const versionBadge = `  ${theme.dim("v")}${theme.secondary(version)} ${theme.dim("│")} ${theme.warning("Early access")} ${theme.dim("│")} ${theme.primary("Real checkout")}`;
  console.log(versionBadge);
  
  console.log();
  console.log(theme.dim("  " + "─".repeat(Math.min(50, termWidth - 4))));
  console.log();
  
  const commands = [
    { cmd: "tm products", desc: "Browse products", icon: icons.search },
    { cmd: "tm search <query>", desc: "Search marketplace", icon: icons.search },
    { cmd: "tm buy <id>", desc: "Purchase a product", icon: icons.buy },
    { cmd: "tm ai list", desc: "AI services", icon: icons.ai },
    { cmd: "tm help", desc: "All commands", icon: icons.info },
  ];
  
  console.log(theme.text.bold("  Quick Start:"));
  console.log();
  
  commands.forEach(({ cmd, desc, icon }) => {
    console.log(`  ${theme.muted(icon)} ${theme.secondary(cmd.padEnd(22))} ${theme.dim(desc)}`);
  });
  
  console.log();
  console.log(theme.dim("  " + "─".repeat(Math.min(50, termWidth - 4))));
  console.log();
  
  console.log(`  ${theme.dim("💡")} ${theme.muted("Run")} ${theme.secondary("tm login")} ${theme.muted("to unlock all features")}`);
  console.log();
}

export function showStatusBar(user = null, location = null, credits = null) {
  const parts = [];
  
  if (user) {
    parts.push(`${icons.check} ${theme.primary(user.name || user.email)}`);
  } else {
    parts.push(`${theme.dim("○ Not logged in")}`);
  }
  
  if (location?.city) {
    parts.push(`${icons.pin} ${theme.text(location.city)}`);
  }
  
  if (credits !== null) {
    parts.push(`${icons.credit} ${theme.warning("$" + parseFloat(credits).toFixed(2))}`);
  }
  
  const statusLine = parts.join(theme.dim(" │ "));
  console.log(theme.dim("  " + statusLine));
}

export function showNextSteps(steps) {
  console.log();
  console.log(theme.dim("  ─────────────────────────────────────────"));
  console.log(`  ${theme.muted("💡 Next steps:")}`);
  console.log();
  
  steps.forEach(({ cmd, desc }) => {
    console.log(`     ${theme.secondary(cmd.padEnd(25))} ${theme.dim(desc)}`);
  });
  
  console.log();
}

export function showError(message, hint = null) {
  console.log();
  console.log(`  ${theme.error(icons.error)} ${theme.error(message)}`);
  if (hint) {
    console.log(`  ${theme.dim("💡 " + hint)}`);
  }
  console.log();
}

export function showSuccess(message) {
  console.log();
  console.log(`  ${theme.primary(icons.success)} ${theme.text(message)}`);
  console.log();
}

export function showWarning(message) {
  console.log();
  console.log(`  ${theme.warning(icons.warning)} ${theme.warning(message)}`);
  console.log();
}

export function showInfo(message) {
  console.log();
  console.log(`  ${theme.secondary(icons.info)} ${theme.text(message)}`);
  console.log();
}

export function showBanner(text, type = "info") {
  const color = type === "error" ? theme.error : 
                type === "warning" ? theme.warning : 
                type === "success" ? theme.primary : theme.secondary;
  console.log();
  console.log(`  ${color("▸")} ${theme.text.bold(text)}`);
  console.log();
}

export function showSection(title) {
  console.log();
  console.log(`  ${theme.gradients.ocean(title)}`);
  console.log(theme.dim("  " + "─".repeat(45)));
  console.log();
}

export function showDivider() {
  console.log(theme.dim("  " + "─".repeat(45)));
}

export function showProgress(current, total, label = "") {
  const width = 30;
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = theme.primary("█".repeat(filled)) + theme.dim("░".repeat(empty));
  const percent = Math.round((current / total) * 100);
  console.log(`  ${bar} ${theme.text(`${percent}%`)} ${theme.dim(label)}`);
}

export function createLink(text, url) {
  return terminalLink(text, url, { fallback: (text, url) => `${text} (${url})` });
}
