import chalk from "chalk";
import boxen from "boxen";
import ora from "ora";
import Table from "cli-table3";
import { getUser, getLocation } from "./config.js";

let currentSpinner = null;

export function createSpinner(text) {
  if (currentSpinner) {
    currentSpinner.stop();
  }
  currentSpinner = ora({
    text,
    color: "green",
    spinner: "dots"
  }).start();
  return currentSpinner;
}

export function stopSpinner(success = true, text = null) {
  if (currentSpinner) {
    if (success) {
      currentSpinner.succeed(text);
    } else {
      currentSpinner.fail(text);
    }
    currentSpinner = null;
  }
}

export function showWelcome(version) {
  const content = `${chalk.green.bold("TerminalMarket CLI")} ${chalk.dim(`v${version}`)}
${chalk.dim("A curated marketplace for developers & founders")}
${chalk.yellow("Early access")} ${chalk.dim("•")} ${chalk.white("Real products")} ${chalk.dim("•")} ${chalk.green("Real checkout")}

${chalk.white("Try one of these:")}
  ${chalk.cyan("tm products")}      ${chalk.dim("— browse products")}
  ${chalk.cyan("tm search lunch")}  ${chalk.dim("— search for lunch deals")}
  ${chalk.cyan("tm buy <id>")}      ${chalk.dim("— purchase a product")}
  ${chalk.cyan("tm start")}         ${chalk.dim("— interactive tour")}

${chalk.dim("This is a pilot marketplace with early partners. Every purchase is real.")}`;

  console.log();
  console.log(boxen(content, {
    padding: 1,
    margin: 0,
    borderStyle: "round",
    borderColor: "green"
  }));
  console.log();
}

export function showBox(title, content, options = {}) {
  const { borderColor = "green", padding = 1 } = options;
  
  const text = title 
    ? `${chalk.bold(title)}\n\n${content}`
    : content;
  
  console.log();
  console.log(boxen(text, {
    padding,
    borderStyle: "round",
    borderColor
  }));
  console.log();
}

export function showError(message, hint = null) {
  let content = chalk.red.bold("Error: ") + chalk.white(message);
  if (hint) {
    content += "\n\n" + chalk.dim("💡 " + hint);
  }
  
  console.log();
  console.log(boxen(content, {
    padding: 1,
    borderStyle: "round",
    borderColor: "red"
  }));
  console.log();
}

export function showSuccess(message) {
  console.log();
  console.log(boxen(chalk.green("✓ ") + chalk.white(message), {
    padding: 1,
    borderStyle: "round",
    borderColor: "green"
  }));
  console.log();
}

export function showStatusBar() {
  const user = getUser();
  const location = getLocation();
  
  const parts = [];
  
  if (location?.city) {
    parts.push(chalk.cyan("📍 " + location.city));
  }
  
  if (user) {
    parts.push(chalk.magenta("👤 " + (user.username || user.email?.split("@")[0] || "User")));
  } else {
    parts.push(chalk.dim("👤 Guest"));
  }
  
  if (parts.length > 0) {
    console.log(chalk.dim("  " + parts.join("  │  ")));
    console.log();
  }
}

export function showNextSteps(steps) {
  console.log();
  console.log(chalk.dim("  Next:"));
  steps.forEach(step => {
    console.log(chalk.dim("    → ") + chalk.cyan(step.cmd) + chalk.dim(" — " + step.desc));
  });
  console.log();
}

export function createTable(headers, options = {}) {
  const { compact = false } = options;
  
  return new Table({
    head: headers.map(h => chalk.cyan.bold(h)),
    style: {
      head: [],
      border: ["dim"],
      compact
    },
    chars: compact ? {
      "top": "", "top-mid": "", "top-left": "", "top-right": "",
      "bottom": "", "bottom-mid": "", "bottom-left": "", "bottom-right": "",
      "left": " ", "left-mid": "", "mid": "", "mid-mid": "",
      "right": "", "right-mid": "", "middle": " │ "
    } : undefined
  });
}

export function printTableData(data, columns) {
  if (!data?.length) {
    console.log(chalk.dim("  No results found."));
    return;
  }
  
  const headers = columns.map(c => c.title);
  const table = createTable(headers, { compact: true });
  
  data.forEach(row => {
    const cells = columns.map(col => {
      let value = row[col.key] ?? "";
      
      if (col.key === "price" || col.key === "total") {
        value = chalk.green(value);
      } else if (col.key === "name" || col.key === "title") {
        value = chalk.white.bold(value);
      } else if (col.key === "id") {
        value = chalk.dim(value);
      } else if (col.key === "status") {
        const status = String(value).toLowerCase();
        if (status === "delivered" || status === "active") {
          value = chalk.green(value);
        } else if (status === "pending") {
          value = chalk.yellow(value);
        } else if (status === "cancelled") {
          value = chalk.red(value);
        }
      }
      
      return value;
    });
    
    table.push(cells);
  });
  
  console.log();
  console.log(table.toString());
  console.log();
  console.log(chalk.dim(`  Showing ${data.length} result${data.length !== 1 ? "s" : ""}`));
}
