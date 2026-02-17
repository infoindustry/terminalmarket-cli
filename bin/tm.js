#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import open from "open";
import readline from "readline";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { apiGet, apiPost, apiDelete, apiPatch, fetchCsrfToken } from "../src/api.js";
import { getApiBase, setApiBase, getUser, setUser, clearUser, clearSession, clearCsrfToken, isFirstRun, markFirstRunComplete, setLocation, getLocation } from "../src/config.js";
import { 
  printTable, pickProductFields, pickSellerFields, pickOfferFields, containsQuery, formatStars,
  printHeader, printDivider, printSuccess, printError, printWarning, printInfo, printField, printEmpty,
  printProductCard, printCart, printOrders, printStoreCard, printSellers, printReviews, printAIModels, printCredits
} from "../src/format.js";
import { 
  theme, icons, showWelcome, showBox, showError, showSuccess, showWarning, showInfo,
  showStatusBar, showNextSteps, createSpinner, stopSpinner, updateSpinner,
  showSection, showDivider, showBanner, showInfoBox, showSuccessBox, showErrorBox,
  showProgress, createLink
} from "../src/ui.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf-8"));
const VERSION = pkg.version;

function getPublicBaseUrl() {
  const apiBase = getApiBase();
  if (!apiBase) {
    return "https://terminalmarket.app";
  }
  try {
    const parsed = new URL(apiBase);
    const host = parsed.host;
    if (host.includes("localhost") || host.startsWith("127.0.0.1")) {
      return "https://terminalmarket.app";
    }
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return "https://terminalmarket.app";
  }
}

function resolveProductUrl(p) {
  return p?.buyUrl || p?.externalUrl || `${getPublicBaseUrl()}/product/${p.slug || p.id}`;
}

function shouldOpenExternal() {
  return process.env.TM_NO_OPEN !== "1";
}

function shouldPrompt() {
  return process.env.TM_NO_PROMPT !== "1";
}

// Helper for hidden password input
function askPassword(prompt = "Password: ") {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    
    process.stdout.write(prompt);
    
    // Mute output
    const stdin = process.stdin;
    const wasRaw = stdin.isRaw;
    if (stdin.isTTY) {
      stdin.setRawMode(true);
    }
    
    let password = "";
    
    const onData = (char) => {
      const c = char.toString();
      
      if (c === "\n" || c === "\r") {
        stdin.removeListener("data", onData);
        if (stdin.isTTY) {
          stdin.setRawMode(wasRaw);
        }
        rl.close();
        console.log(); // New line
        resolve(password);
      } else if (c === "\u0003") {
        // Ctrl+C
        process.exit();
      } else if (c === "\u007F" || c === "\b") {
        // Backspace
        password = password.slice(0, -1);
      } else {
        password += c;
      }
    };
    
    stdin.on("data", onData);
  });
}

const program = new Command();

program
  .name("tm")
  .description("TerminalMarket CLI — marketplace for developers")
  .version(VERSION)
  .helpOption(false)
  .addHelpCommand(false);

// -----------------
// config
// -----------------
const config = program
  .command("config")
  .description("Get/set CLI config");

config
  .command("get <key>")
  .description("Get a config value (e.g. api)")
  .action((key) => {
    if (key === "api") {
      console.log(getApiBase());
      return;
    }
    console.error(chalk.red(`Unknown key: ${key}`));
    process.exitCode = 1;
  });

config
  .command("set <key> <value>")
  .description("Set a config value (e.g. api)")
  .action((key, value) => {
    if (key === "api") {
      setApiBase(value);
      console.log(chalk.green(`api = ${getApiBase()}`));
      return;
    }
    console.error(chalk.red(`Unknown key: ${key}`));
    process.exitCode = 1;
  });

// -----------------
// auth commands
// -----------------
program
  .command("register <email> [password]")
  .description("Create a new account (password will be prompted securely)")
  .option("-n, --name <name>", "Your name")
  .option("-u, --username <username>", "Username")
  .action(async (email, passwordArg, opts) => {
    try {
      const password = passwordArg || await askPassword();
      const username = opts.username || email.split("@")[0];
      const result = await apiPost("/auth/register", {
        email,
        password,
        username,
        name: opts.name || username
      });
      
      if (result.user) {
        setUser(result.user);
        console.log(chalk.green(`Welcome, ${result.user.name || result.user.email}!`));
        console.log(chalk.dim("You are now logged in."));
        await fetchCsrfToken();
      } else {
        console.log(chalk.green("Registration successful! Please login."));
      }
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

program
  .command("login <email> [password]")
  .description("Login to your account (password will be prompted securely)")
  .action(async (email, passwordArg) => {
    try {
      const password = passwordArg || await askPassword();
      const result = await apiPost("/auth/login", { email, password });
      
      if (result.user) {
        setUser(result.user);
        console.log(chalk.green(`Welcome back, ${result.user.name || result.user.email}!`));
      } else {
        console.log(chalk.green("Login successful!"));
      }
      await fetchCsrfToken();
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

program
  .command("logout")
  .description("Logout from your account")
  .action(async () => {
    try {
      await apiPost("/auth/logout", {});
      clearUser();
      clearSession();
      clearCsrfToken();
      console.log(chalk.green("Logged out successfully."));
    } catch (e) {
      clearUser();
      clearSession();
      clearCsrfToken();
      console.log(chalk.green("Logged out."));
    }
  });

// GitHub auth - opens browser
program
  .command("auth")
  .description("Authenticate with GitHub (opens browser)")
  .argument("[provider]", "Auth provider (github)")
  .action(async (provider) => {
    if (!provider || provider === "github") {
      const apiBase = getApiBase();
      const authUrl = `${apiBase}/auth/github`;
      console.log(chalk.green("Opening GitHub authentication..."));
      console.log(chalk.dim(authUrl));
      try {
        if (shouldOpenExternal()) {
          await open(authUrl);
          console.log(chalk.dim("Complete login in browser, then run 'tm whoami' to verify."));
        } else {
          console.log(chalk.yellow("Browser opening disabled. Visit manually:"));
          console.log(authUrl);
        }
      } catch {
        console.log(chalk.yellow("Could not open browser. Visit manually:"));
        console.log(authUrl);
      }
    } else {
      console.error(chalk.red(`Unknown provider: ${provider}. Use 'github'.`));
    }
  });

program
  .command("github")
  .description("Login with GitHub (opens browser)")
  .action(async () => {
    const apiBase = getApiBase();
    const authUrl = `${apiBase}/auth/github`;
    console.log(chalk.green("Opening GitHub authentication..."));
    try {
      if (shouldOpenExternal()) {
        await open(authUrl);
        console.log(chalk.dim("Complete login in browser, then run 'tm whoami' to verify."));
      } else {
        console.log(chalk.yellow("Browser opening disabled. Visit:"));
        console.log(authUrl);
      }
    } catch {
      console.log(chalk.yellow("Could not open browser. Visit:"));
      console.log(authUrl);
    }
  });

// Invite a colleague
program
  .command("invite")
  .description("Invite a colleague by email")
  .option("-e, --email <email>", "Email address to invite")
  .option("-l, --link", "Get your invite link")
  .action(async (opts) => {
    try {
      if (opts.link) {
        const result = await apiGet("/invite/link");
        console.log(result?.link || "Invite link unavailable");
        return;
      }

      const email = opts.email;
      if (!email) {
        console.log(chalk.yellow("Usage: tm invite --email colleague@company.com"));
        console.log(chalk.dim("Or share your link: tm invite --link"));
        return;
      }

      await apiPost("/invite", { email });
      console.log(chalk.green("✓ Invite sent!"));
      console.log("Share your link: tm invite --link");
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

program
  .command("whoami")
  .alias("me")
  .description("Show current user info")
  .action(async () => {
    try {
      const result = await apiGet("/auth/status");
      
      if (result.isAuthenticated && result.user) {
        console.log(chalk.bold(result.user.name || result.user.email));
        console.log(`${chalk.dim("email:")} ${result.user.email}`);
        if (result.user.name) console.log(`${chalk.dim("name:")} ${result.user.name}`);
        if (result.user.role) console.log(`${chalk.dim("role:")} ${result.user.role}`);
      } else {
        console.log(chalk.yellow("Not logged in. Use 'tm login <email> <password>' to login."));
      }
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// -----------------
// profile command
// -----------------
const profile = program
  .command("profile")
  .description("View or edit your profile");

async function showProfile() {
  const result = await apiGet("/auth/status");
  if (!result.isAuthenticated) {
    console.log(chalk.yellow("Not logged in. Use 'tm login' first."));
    return;
  }
  const user = result.user;
  
  // Availability status
  const availStatus = user.availableForHire 
    ? chalk.green('🟢 Available for hire')
    : chalk.dim('⚫ Not looking');
  
  console.log();
  console.log(chalk.green.bold('┌─────────────────────────────────────┐'));
  console.log(chalk.green.bold('│') + chalk.white.bold('  Developer Profile') + ' '.repeat(17) + chalk.green.bold('│'));
  console.log(chalk.green.bold('└─────────────────────────────────────┘'));
  console.log(`  ${availStatus}`);
  console.log();
  
  // Basic info
  console.log(chalk.cyan.bold('  Basic Info'));
  console.log(`  ${chalk.dim('Username:')}  ${chalk.white(user.username || user.email?.split('@')[0] || '-')}`);
  console.log(`  ${chalk.dim('Email:')}     ${chalk.cyan(user.email || '-')}`);
  console.log(`  ${chalk.dim('Name:')}      ${user.name || chalk.dim('(not set)')}`);
  console.log(`  ${chalk.dim('Phone:')}     ${user.phone || chalk.dim('(not set)')}`);
  console.log(`  ${chalk.dim('Location:')}  ${[user.city, user.country].filter(Boolean).join(', ') || chalk.dim('(not set)')}`);
  console.log();
  
  // Developer info
  console.log(chalk.cyan.bold('  Developer Profile'));
  console.log(`  ${chalk.dim('GitHub:')}    ${user.githubUsername ? '@' + user.githubUsername : chalk.dim('(not set)')}`);
  console.log(`  ${chalk.dim('LinkedIn:')}  ${user.linkedinUrl || chalk.dim('(not set)')}`);
  console.log(`  ${chalk.dim('Skills:')}    ${user.skills?.length ? user.skills.join(', ') : chalk.dim('(not set)')}`);
  if (user.bio) {
    console.log(`  ${chalk.dim('Bio:')}       ${user.bio}`);
  }
  console.log();
  console.log(chalk.dim('  Use: tm profile set <field> <value>'));
  console.log(chalk.dim('  Fields: name, phone, city, country, github, linkedin, skills, bio, available'));
  console.log();
}

async function setProfileField(field, value) {
  const result = await apiGet("/auth/status");
  if (!result.isAuthenticated) {
    console.log(chalk.yellow("Not logged in. Use 'tm login' first."));
    return;
  }
  
  // Map CLI field names to API field names
  const fieldMapping = {
    name: "name",
    phone: "phone",
    address: "address",
    city: "city",
    country: "country",
    github: "githubUsername",
    linkedin: "linkedinUrl",
    skills: "skills",
    bio: "bio",
    available: "availableForHire",
  };
  
  const apiField = fieldMapping[field];
  if (!apiField) {
    console.error(chalk.red(`✗ Invalid field. Valid fields: ${Object.keys(fieldMapping).join(", ")}`));
    return;
  }
  
  let newValue = value.join(" ");
  if (!newValue) {
    console.error(chalk.red("✗ Value is required."));
    return;
  }
  
  // Process special fields
  let processedValue = newValue;
  if (field === "skills") {
    processedValue = newValue.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
  } else if (field === "available") {
    processedValue = newValue.toLowerCase() === "true" || newValue === "1" || newValue === "yes";
    newValue = processedValue ? "Available for hire ✓" : "Not looking";
  }
  
  await apiPatch("/profile", { [apiField]: processedValue });
  console.log(chalk.green(`✓ Updated ${field} to "${newValue}"`));
}

profile
  .command("view")
  .description("Show your profile")
  .action(async () => {
    try {
      await showProfile();
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

profile
  .command("set <field> [value...]")
  .description("Update profile field (name, phone, address, city, country)")
  .action(async (field, value) => {
    try {
      await setProfileField(field, value);
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

profile.action(async () => {
  try {
    await showProfile();
  } catch (e) {
    console.error(chalk.red(e?.message || String(e)));
    process.exitCode = 1;
  }
});

// -----------------
// cart commands
// -----------------
const cart = program
  .command("cart")
  .description("Manage your shopping cart");

cart
  .command("list")
  .alias("ls")
  .description("View cart contents")
  .action(async () => {
    try {
      const cartData = await apiGet("/cart");
      
      let total = 0;
      if (cartData.items?.length) {
        cartData.items.forEach((item) => {
          total += (item.price || 0) * (item.quantity || 1);
        });
      }
      
      printCart(cartData.items || [], total);
    } catch (e) {
      printError(e?.message || String(e));
      process.exitCode = 1;
    }
  });

cart
  .command("add <productId>")
  .description("Add product to cart")
  .option("-q, --quantity <n>", "Quantity", "1")
  .action(async (productId, opts) => {
    try {
      const quantity = parseInt(opts.quantity) || 1;
      const pid = /^\d+$/.test(productId) ? parseInt(productId) : productId;
      await apiPost("/cart/add", { productId: pid, quantity });
      printSuccess(`Added to cart (qty: ${quantity})`);
    } catch (e) {
      printError(e?.message || String(e));
      process.exitCode = 1;
    }
  });

cart
  .command("remove <productId>")
  .description("Remove product from cart")
  .action(async (productId) => {
    try {
      const pid = /^\d+$/.test(productId) ? parseInt(productId) : productId;
      await apiPost("/cart/remove", { productId: pid });
      printSuccess("Removed from cart");
    } catch (e) {
      printError(e?.message || String(e));
      process.exitCode = 1;
    }
  });

cart
  .command("clear")
  .description("Clear all items from cart")
  .action(async () => {
    try {
      await apiPost("/cart/clear", {});
      printSuccess("Cart cleared");
    } catch (e) {
      printError(e?.message || String(e));
      process.exitCode = 1;
    }
  });

// Shortcut for cart add
program
  .command("add <productId>")
  .description("Add product to cart (shortcut)")
  .option("-q, --quantity <n>", "Quantity", "1")
  .action(async (productId, opts) => {
    try {
      const quantity = parseInt(opts.quantity) || 1;
      const pid = /^\d+$/.test(productId) ? parseInt(productId) : productId;
      await apiPost("/cart/add", { productId: pid, quantity });
      console.log(chalk.green(`Added to cart (qty: ${quantity})`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// -----------------
// checkout command
// -----------------
program
  .command("checkout")
  .description("Proceed to checkout")
  .action(async () => {
    try {
      const cartData = await apiGet("/cart");
      
      if (!cartData.items || cartData.items.length === 0) {
        console.log(chalk.yellow("Your cart is empty. Add items first."));
        return;
      }
      
      console.log(chalk.bold("Checkout"));
      console.log("");
      console.log("Your items:");
      
      let total = 0;
      cartData.items.forEach((item, i) => {
        const subtotal = (item.price || 0) * (item.quantity || 1);
        total += subtotal;
        console.log(`  ${i + 1}. ${item.name} x${item.quantity} = $${subtotal.toFixed(2)}`);
      });
      
      console.log("");
      console.log(chalk.bold(`Total: $${total.toFixed(2)}`));
      console.log("");
      console.log(chalk.dim("To complete checkout, visit the web terminal or use:"));
      console.log(chalk.dim("  tm checkout --confirm"));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// -----------------
// orders command
// -----------------
program
  .command("orders")
  .alias("history")
  .description("View your order history")
  .option("-l, --limit <n>", "Limit results", "10")
  .action(async (opts) => {
    try {
      const orders = await apiGet("/orders");
      const limit = parseInt(opts.limit) || 10;
      printOrders((orders || []).slice(0, limit));
    } catch (e) {
      printError(e?.message || String(e));
      process.exitCode = 1;
    }
  });

// -----------------
// review commands
// -----------------
program
  .command("review <storeId> <rating>")
  .description("Leave a review for a store (1-5 stars)")
  .argument("[comment...]", "Optional comment")
  .action(async (storeId, rating, comment) => {
    try {
      const ratingNum = parseInt(rating);
      if (ratingNum < 1 || ratingNum > 5) {
        console.error(chalk.red("Rating must be between 1 and 5."));
        return;
      }
      
      const commentText = comment.join(" ") || undefined;
      
      await apiPost(`/stores/${storeId}/reviews`, {
        rating: ratingNum,
        comment: commentText
      });
      
      console.log(chalk.green(`Review submitted! ${formatStars(ratingNum)}`));
      if (commentText) {
        console.log(chalk.dim(`Comment: "${commentText}"`));
      }
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

program
  .command("reviews <storeId>")
  .alias("ratings")
  .description("View reviews for a store")
  .action(async (storeId) => {
    try {
      const data = await apiGet(`/stores/${storeId}/reviews`);
      printReviews(data.reviews || [], data.averageRating);
    } catch (e) {
      printError(e?.message || String(e));
      process.exitCode = 1;
    }
  });

// -----------------
// store command
// -----------------
program
  .command("store <storeId>")
  .description("View store details")
  .action(async (storeId) => {
    try {
      const store = await apiGet(`/stores/${storeId}`);
      
      if (!store) {
        printError("Store not found");
        return;
      }
      
      // Get rating
      try {
        const rating = await apiGet(`/stores/${storeId}/rating`);
        if (rating.count > 0) {
          store.rating = rating.average;
        }
      } catch {}
      
      printStoreCard(store);
    } catch (e) {
      printError(e?.message || String(e));
      process.exitCode = 1;
    }
  });

// -----------------
// AI commands
// -----------------
const ai = program
  .command("ai")
  .description("AI services - run AI models with credits");

ai
  .command("list")
  .alias("ls")
  .description("List available AI models")
  .action(async () => {
    try {
      const data = await apiGet("/ai/models");
      const { models, categories } = data;
      
      // Add category names to models
      const catMap = new Map((categories || []).map(c => [c.id, c]));
      const modelsWithCat = (models || []).map(m => ({
        ...m,
        categoryName: catMap.get(m.categoryId)?.name || 'Other',
        creditsPerRun: '$' + parseFloat(m.pricePerRun).toFixed(4)
      }));
      
      printAIModels(modelsWithCat, categories);
    } catch (e) {
      printError(e?.message || String(e));
      process.exitCode = 1;
    }
  });

ai
  .command("run <model> [input...]")
  .description("Run an AI model")
  .action(async (model, input) => {
    try {
      const inputText = input.join(" ");
      if (!inputText) {
        console.error(chalk.red("Input is required. Usage: tm ai run <model> <input>"));
        return;
      }
      
      // Check if agent supports chat (has workflowId) — use Responses API for better results
      let hasChatKit = false;
      try {
        const agentInfo = await apiGet(`/ai/agents/${model}`);
        hasChatKit = !!agentInfo?.hasChatKit;
      } catch {
        // Not found or no info — proceed with regular run
      }
      
      let result;
      if (hasChatKit) {
        // Use chat endpoint (Responses API) for workflow agents
        result = await apiPost(`/ai/chat/${model}`, { message: inputText });
        
        console.log(chalk.bold.cyan(`🧠 ${result.model || model}`));
        console.log("");
        
        if (result.text) {
          try {
            const parsed = JSON.parse(result.text);
            printStructured(parsed, 0);
          } catch {
            console.log(chalk.white(result.text));
          }
        }
        
        console.log("");
        const creditsUsed = Number(result.creditsUsed ?? 0);
        const newBalance = result.newBalance ?? "0.0000";
        console.log(`${chalk.dim("credits used:")} $${creditsUsed.toFixed(4)}`);
        console.log(`${chalk.dim("new balance:")} $${newBalance}`);
      } else {
        // Regular model — use run endpoint
        result = await apiPost(`/ai/run/${model}`, { input: inputText });
        
        console.log(chalk.bold("AI Result"));
        console.log("");
        
        // Handle structured agent output
        const agentOutput = result.output;
        if (agentOutput?.resultText || agentOutput?.result) {
          const content = agentOutput.result;
          if (typeof content === 'string') {
            try {
              const parsed = JSON.parse(content);
              printStructured(parsed, 0);
            } catch {
              console.log(chalk.white(content));
            }
          } else if (content && typeof content === 'object') {
            printStructured(content, 0);
          } else if (agentOutput.resultText) {
            try {
              const parsed = JSON.parse(agentOutput.resultText);
              printStructured(parsed, 0);
            } catch {
              console.log(chalk.white(agentOutput.resultText));
            }
          }
          if (agentOutput.runTimeMs) {
            console.log(chalk.dim(`⚡ ${(agentOutput.runTimeMs / 1000).toFixed(1)}s`));
          }
        } else if (agentOutput?.message) {
          console.log(agentOutput.message);
        }
        if (agentOutput?.note) {
          console.log(chalk.dim(agentOutput.note));
        }
        
        console.log("");
        const creditsUsed = Number(result.creditsUsed ?? 0);
        const newBalance = result.newBalance ?? "0.0000";
        console.log(`${chalk.dim("credits used:")} $${creditsUsed.toFixed(4)}`);
        console.log(`${chalk.dim("new balance:")} $${newBalance}`);
      }
    } catch (e) {
      if (e?.message?.includes("402") || e?.message?.includes("Insufficient")) {
        console.error(chalk.red("Insufficient credits. Use 'tm ai topup <amount>' to add credits."));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
      process.exitCode = 1;
    }
  });

ai
  .command("chat <agent> [message...]")
  .description("Interactive chat with an AI agent")
  .action(async (agent, message) => {
    try {
      // Check if agent exists and supports chat
      let agentInfo;
      try {
        agentInfo = await apiGet(`/ai/agents/${agent}`);
      } catch {
        console.error(chalk.red(`Agent "${agent}" not found. Use 'tm ai list' to see available agents.`));
        process.exitCode = 1;
        return;
      }

      console.log(chalk.bold.cyan(`🧠 ${agentInfo.name}`));
      if (agentInfo.description) console.log(chalk.dim(agentInfo.description));
      console.log(chalk.dim(`Price per message: $${parseFloat(agentInfo.pricePerRun).toFixed(4)}`));
      console.log(chalk.dim('Type "exit" or "quit" to end chat.\n'));

      // If initial message provided, send it first
      const initialMessage = message?.join(" ");

      // Use Responses API for conversation (previous_response_id chain)
      let previousResponseId = null;

      const sendMessage = async (text) => {
        try {
          const result = await apiPost(`/ai/chat/${agent}`, { 
            message: text,
            ...(previousResponseId ? { previousResponseId } : {})
          });

          // Store response ID for conversation continuity
          if (result.responseId) {
            previousResponseId = result.responseId;
          }

          // Print the result
          if (result.text) {
            // Try to parse as structured JSON
            try {
              const parsed = JSON.parse(result.text);
              printStructured(parsed, 0);
            } catch {
              // Plain text — print as markdown-like
              console.log(chalk.white(result.text));
            }
          } else {
            console.log(chalk.dim("(no response)"));
          }

          const creditsUsed = Number(result.creditsUsed ?? 0);
          console.log(chalk.dim(`\n  [$${creditsUsed.toFixed(4)} credits | balance: $${result.newBalance}]`));
          console.log();
        } catch (e) {
          if (e?.message?.includes("402") || e?.message?.includes("Insufficient")) {
            console.error(chalk.red("Insufficient credits. Use 'tm ai topup <amount>' to add."));
          } else {
            console.error(chalk.red(e?.message || "Failed to get response"));
          }
        }
      };

      // Send initial message if provided
      if (initialMessage) {
        console.log(chalk.green(`you: ${initialMessage}`));
        await sendMessage(initialMessage);
      }

      // Interactive loop
      const readline = await import('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      const prompt = () => {
        rl.question(chalk.green('you: '), async (line) => {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'exit' || trimmed === 'quit' || trimmed === '/exit') {
            console.log(chalk.dim('Chat ended.'));
            rl.close();
            return;
          }
          await sendMessage(trimmed);
          prompt();
        });
      };

      prompt();
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// Helper: pretty-print structured JSON in terminal
function printStructured(obj, depth) {
  if (!obj || typeof obj !== 'object') {
    console.log(chalk.white(String(obj)));
    return;
  }
  const indent = '  '.repeat(depth);
  for (const [key, value] of Object.entries(obj)) {
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    if (Array.isArray(value)) {
      console.log(`${indent}${chalk.cyan(label)}:`);
      for (const item of value) {
        if (typeof item === 'object' && item !== null) {
          console.log(`${indent}  ${chalk.dim('─')}`);
          printStructured(item, depth + 2);
        } else {
          console.log(`${indent}  ${chalk.dim('•')} ${chalk.white(String(item))}`);
        }
      }
    } else if (typeof value === 'object' && value !== null) {
      // Inline small objects (price, location)
      const keys = Object.keys(value);
      if (keys.length <= 3 && keys.every(k => typeof value[k] !== 'object')) {
        const parts = Object.entries(value).map(([k, v]) => `${v}`).join(' ');
        console.log(`${indent}${chalk.cyan(label)}: ${chalk.white(parts)}`);
      } else {
        console.log(`${indent}${chalk.cyan(label)}:`);
        printStructured(value, depth + 1);
      }
    } else if (typeof value === 'boolean') {
      console.log(`${indent}${chalk.cyan(label)}: ${value ? chalk.green('✓ Yes') : chalk.red('✗ No')}`);
    } else {
      console.log(`${indent}${chalk.cyan(label)}: ${chalk.white(String(value))}`);
    }
  }
}

ai
  .command("credits")
  .alias("balance")
  .description("Check your AI credit balance")
  .action(async () => {
    try {
      const credits = await apiGet("/credits");
      
      console.log();
      console.log(chalk.cyan.bold('  💳 AI Credits'));
      console.log();
      console.log(`  ${chalk.white('Balance:')}     ${chalk.green.bold('$' + parseFloat(credits.balance).toFixed(4))}`);
      console.log(`  ${chalk.dim('Purchased:')}   $${parseFloat(credits.totalPurchased).toFixed(2)}`);
      console.log(`  ${chalk.dim('Spent:')}       $${parseFloat(credits.totalSpent).toFixed(4)}`);
      console.log();
      console.log(chalk.dim('  💡 tm ai topup <amount> — add more credits'));
      console.log();
    } catch (e) {
      if (e?.message?.includes("401") || e?.message?.includes("Login")) {
        printWarning("Please login first: tm login <email>");
      } else {
        printError(e?.message || String(e));
        process.exitCode = 1;
      }
    }
  });

ai
  .command("topup <amount>")
  .alias("add")
  .description("Add credits to your account ($5 minimum)")
  .action(async (amount) => {
    try {
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum < 5) {
        console.error(chalk.red("Minimum top-up is $5"));
        return;
      }
      
      const result = await apiPost("/credits/topup", { amount: amountNum });
      
      console.log(chalk.green("Payment link created!"));
      console.log("");
      console.log("Open this link to complete payment:");
      console.log(chalk.cyan(result.url));
      console.log("");
      console.log(chalk.dim("Credits will be added after payment."));
      
      // Try to open in browser
      if (shouldOpenExternal()) {
        try {
          await open(result.url);
          console.log(chalk.dim("(Opening in browser...)"));
        } catch {}
      }
    } catch (e) {
      if (e?.message?.includes("401") || e?.message?.includes("Login")) {
        console.log(chalk.yellow("Please login first: tm login <email> <password>"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
        process.exitCode = 1;
      }
    }
  });

ai
  .command("history")
  .description("View your AI usage history")
  .option("-l, --limit <n>", "Limit results", "20")
  .action(async (opts) => {
    try {
      const logs = await apiGet("/ai/history");
      const limit = parseInt(opts.limit) || 20;
      
      if (!logs || logs.length === 0) {
        console.log(chalk.yellow("No AI usage history yet."));
        console.log(chalk.dim("Try: tm ai run <model> <input>"));
        return;
      }
      
      console.log(chalk.bold("AI Usage History"));
      console.log("");
      
      logs.slice(0, limit).forEach(log => {
        const date = new Date(log.createdAt).toLocaleDateString();
        const credits = parseFloat(log.creditsCharged).toFixed(4);
        const statusColor = log.status === "completed" ? chalk.green : 
                           log.status === "failed" ? chalk.red : chalk.yellow;
        
        console.log(`${date}  Model #${log.modelId}  $${credits}  ${statusColor(log.status)}`);
      });
    } catch (e) {
      if (e?.message?.includes("401") || e?.message?.includes("Login")) {
        console.log(chalk.yellow("Please login first: tm login <email> <password>"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
        process.exitCode = 1;
      }
    }
  });

// Shortcuts for AI commands
program
  .command("credits")
  .description("Check AI credits (shortcut)")
  .action(async () => {
    try {
      const credits = await apiGet("/credits");
      console.log(chalk.bold("AI Credits"));
      console.log(`${chalk.dim("balance:")} $${parseFloat(credits.balance).toFixed(4)}`);
      console.log(chalk.dim("Top up: tm ai topup <amount>"));
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first."));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

program
  .command("topup <amount>")
  .description("Add AI credits (shortcut)")
  .action(async (amount) => {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum < 5) {
      console.error(chalk.red("Minimum top-up is $5"));
      return;
    }
    try {
      const result = await apiPost("/credits/topup", { amount: amountNum });
      console.log(chalk.green("Payment link: ") + chalk.cyan(result.url));
      if (shouldOpenExternal()) {
        try { await open(result.url); } catch {}
      }
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

// -----------------
// alias commands
// -----------------
const alias = program
  .command("alias")
  .description("Manage custom command aliases");

alias
  .command("list")
  .alias("ls")
  .description("List your aliases")
  .action(async () => {
    try {
      const aliases = await apiGet("/aliases");
      
      if (!aliases || aliases.length === 0) {
        console.log(chalk.yellow("No aliases defined."));
        console.log(chalk.dim("Create one: tm alias add <name> <command>"));
        return;
      }
      
      console.log(chalk.bold("Your Aliases"));
      console.log("");
      aliases.forEach(a => {
        console.log(`  ${chalk.cyan(a.name)} → ${a.command}`);
      });
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first."));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

alias
  .command("add <name> <command...>")
  .description("Create an alias")
  .action(async (name, command) => {
    try {
      const commandStr = command.join(" ");
      await apiPost("/aliases", { name, command: commandStr });
      console.log(chalk.green(`Alias created: ${name} → ${commandStr}`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

alias
  .command("remove <name>")
  .alias("rm")
  .description("Remove an alias")
  .action(async (name) => {
    try {
      await apiDelete(`/aliases/${encodeURIComponent(name)}`);
      console.log(chalk.green(`Alias '${name}' removed.`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

program
  .command("aliases")
  .description("List your aliases (shortcut)")
  .action(async () => {
    try {
      const aliases = await apiGet("/aliases");
      if (!aliases || aliases.length === 0) {
        console.log(chalk.yellow("No aliases. Create: tm alias add <name> <command>"));
        return;
      }
      aliases.forEach(a => {
        console.log(`${chalk.cyan(a.name)} → ${a.command}`);
      });
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first."));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

// -----------------
// reward commands (Push Rewards)
// -----------------
const reward = program
  .command("reward")
  .description("Manage push rewards (auto-order after GitHub pushes)");

reward
  .command("list")
  .alias("ls")
  .description("List your reward rules")
  .action(async () => {
    try {
      const rules = await apiGet("/rewards");
      
      if (!rules || rules.length === 0) {
        console.log(chalk.yellow("No reward rules defined."));
        console.log(chalk.dim("Create one: tm reward add <productId> <pushCount>"));
        return;
      }
      
      console.log(chalk.bold("Your Reward Rules"));
      console.log("");
      rules.forEach(r => {
        const status = r.active ? chalk.green("active") : chalk.dim("paused");
        console.log(`  Product #${r.productId}: every ${r.pushCount} pushes [${status}]`);
        console.log(`    ${chalk.dim(`progress: ${r.currentPushes || 0}/${r.pushCount}`)}`);
      });
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first."));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

reward
  .command("add <productId> <pushCount>")
  .description("Create a reward rule (auto-order after N pushes)")
  .action(async (productId, pushCount) => {
    try {
      await apiPost("/rewards", {
        productId: /^\d+$/.test(productId) ? parseInt(productId) : productId,
        pushCount: parseInt(pushCount)
      });
      console.log(chalk.green(`Reward rule created! Product #${productId} every ${pushCount} pushes.`));
      console.log(chalk.dim("Connect GitHub webhook to start tracking pushes."));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

reward
  .command("remove <productId>")
  .alias("rm")
  .description("Remove a reward rule")
  .action(async (productId) => {
    try {
      await apiDelete(`/rewards/${productId}`);
      console.log(chalk.green(`Reward rule for product #${productId} removed.`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

program
  .command("rewards")
  .description("List reward rules (shortcut)")
  .action(async () => {
    try {
      const rules = await apiGet("/rewards");
      if (!rules || rules.length === 0) {
        console.log(chalk.yellow("No reward rules. Create: tm reward add <productId> <pushCount>"));
        return;
      }
      rules.forEach(r => {
        const status = r.active ? chalk.green("✓") : chalk.dim("○");
        console.log(`${status} Product #${r.productId}: every ${r.pushCount} pushes (${r.currentPushes || 0}/${r.pushCount})`);
      });
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first."));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

// -----------------
// subscriptions (recurring orders)
// -----------------
const DAYS_SHORT = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const subscribe = program
  .command("subscribe")
  .description("Manage recurring order subscriptions");

subscribe
  .command("list")
  .description("List your subscriptions")
  .action(async () => {
    try {
      const subs = await apiGet("/subscriptions");
      if (!subs || subs.length === 0) {
        console.log(chalk.yellow("No subscriptions yet."));
        console.log(chalk.dim("Create one: tm subscribe add <productId> <frequency> [options]"));
        return;
      }
      console.log(chalk.bold("\nYour Subscriptions\n"));
      subs.forEach(s => {
        const status = s.status === 'active' ? chalk.green("✓") : 
                       s.status === 'paused' ? chalk.yellow("⏸") : chalk.dim("✗");
        const schedule = formatSchedule(s.frequency, s.dayOfWeek, s.dayOfMonth, s.timeOfDay);
        const next = s.nextOrderAt ? new Date(s.nextOrderAt).toLocaleDateString() : '-';
        console.log(`${status} #${s.id} ${chalk.cyan(s.name || 'Subscription')}`);
        console.log(`   ${chalk.dim('Product:')} ${s.product?.name || `ID #${s.productId}`}`);
        console.log(`   ${chalk.dim('Schedule:')} ${schedule}`);
        console.log(`   ${chalk.dim('Next:')} ${next}  ${chalk.dim('Orders:')} ${s.totalOrders}`);
        console.log();
      });
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first: tm login"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

function formatSchedule(frequency, dayOfWeek, dayOfMonth, timeOfDay) {
  const time = timeOfDay || '09:00';
  if (frequency === 'daily') return `Daily at ${time}`;
  if (frequency === 'weekly' && dayOfWeek != null) return `${DAYS_FULL[dayOfWeek]} at ${time}`;
  if (frequency === 'monthly' && dayOfMonth != null) {
    const suffix = dayOfMonth > 3 && dayOfMonth < 21 ? 'th' : 
                   dayOfMonth % 10 === 1 ? 'st' : 
                   dayOfMonth % 10 === 2 ? 'nd' : 
                   dayOfMonth % 10 === 3 ? 'rd' : 'th';
    return `${dayOfMonth}${suffix} of month at ${time}`;
  }
  return frequency;
}

subscribe
  .command("add <productId> <frequency>")
  .description("Create a subscription (daily/weekly/monthly)")
  .option("-d, --day <day>", "Day of week (mon-sun) for weekly, or day number (1-31) for monthly")
  .option("-t, --time <time>", "Time of day (HH:MM)", "09:00")
  .option("-n, --name <name>", "Subscription name")
  .action(async (productId, frequency, options) => {
    try {
      const validFreq = ['daily', 'weekly', 'monthly'];
      if (!validFreq.includes(frequency)) {
        console.log(chalk.red(`Invalid frequency. Use: ${validFreq.join(', ')}`));
        return;
      }
      
      const payload = {
        productId: /^\d+$/.test(productId) ? parseInt(productId) : productId,
        frequency,
        timeOfDay: options.time,
        name: options.name,
      };
      
      if (frequency === 'weekly') {
        const dayIndex = DAYS_SHORT.indexOf(options.day?.toLowerCase());
        if (dayIndex === -1) {
          console.log(chalk.red("Weekly requires --day (mon, tue, wed, thu, fri, sat, sun)"));
          return;
        }
        payload.dayOfWeek = dayIndex;
      }
      
      if (frequency === 'monthly') {
        const dayNum = parseInt(options.day);
        if (isNaN(dayNum) || dayNum < 1 || dayNum > 31) {
          console.log(chalk.red("Monthly requires --day (1-31)"));
          return;
        }
        payload.dayOfMonth = dayNum;
      }
      
      const sub = await apiPost("/subscriptions", payload);
      console.log(chalk.green(`\n✓ Subscription created!`));
      console.log(`  ${chalk.dim('Name:')} ${sub.name}`);
      console.log(`  ${chalk.dim('Product:')} ${sub.product?.name || productId}`);
      console.log(`  ${chalk.dim('Schedule:')} ${formatSchedule(sub.frequency, sub.dayOfWeek, sub.dayOfMonth, sub.timeOfDay)}`);
      console.log(`  ${chalk.dim('Next order:')} ${new Date(sub.nextOrderAt).toLocaleString()}`);
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first: tm login"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

subscribe
  .command("pause <id>")
  .description("Pause a subscription")
  .action(async (id) => {
    try {
      await apiPatch(`/subscriptions/${id}`, { status: 'paused' });
      console.log(chalk.green(`Subscription #${id} paused.`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

subscribe
  .command("resume <id>")
  .description("Resume a paused subscription")
  .action(async (id) => {
    try {
      await apiPatch(`/subscriptions/${id}`, { status: 'active' });
      console.log(chalk.green(`Subscription #${id} resumed.`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

subscribe
  .command("cancel <id>")
  .description("Cancel a subscription")
  .action(async (id) => {
    try {
      await apiDelete(`/subscriptions/${id}`);
      console.log(chalk.green(`Subscription #${id} cancelled.`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

program
  .command("subscriptions")
  .description("List subscriptions (shortcut)")
  .action(async () => {
    try {
      const subs = await apiGet("/subscriptions");
      if (!subs || subs.length === 0) {
        console.log(chalk.yellow("No subscriptions. Create: tm subscribe add <productId> <frequency>"));
        return;
      }
      subs.forEach(s => {
        const status = s.status === 'active' ? chalk.green("✓") : chalk.yellow("⏸");
        const schedule = formatSchedule(s.frequency, s.dayOfWeek, s.dayOfMonth, s.timeOfDay);
        console.log(`${status} #${s.id} ${s.name || 'Subscription'} - ${schedule}`);
      });
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first: tm login"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

// -----------------
// wishlist
// -----------------
const wishlist = program
  .command("wishlist")
  .description("Manage your wishlist (saved products)");

wishlist
  .command("list")
  .description("Show your wishlist")
  .action(async () => {
    try {
      const items = await apiGet("/wishlist");
      if (!items || items.length === 0) {
        console.log(chalk.yellow("Your wishlist is empty."));
        console.log(chalk.dim("Add products: tm wishlist add <productId>"));
        return;
      }
      console.log(chalk.bold("\nYour Wishlist\n"));
      items.forEach((item, idx) => {
        const priceChange = getPriceChangeStr(item.priceAtAdd, item.product?.price);
        console.log(`${chalk.cyan(idx + 1 + ')')} ${item.product?.name || `Product #${item.productId}`}`);
        console.log(`   ${chalk.dim('Price:')} ${item.product?.price || '?'}${priceChange}`);
        if (item.note) console.log(`   ${chalk.dim('Note:')} ${item.note}`);
        if (item.priceAlert) console.log(`   ${chalk.yellow('Alert:')} ${item.targetPrice}`);
        console.log();
      });
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first: tm login"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

function getPriceChangeStr(oldPrice, newPrice) {
  if (!oldPrice || !newPrice) return '';
  const old = parseFloat(oldPrice);
  const curr = parseFloat(newPrice);
  if (old === curr) return '';
  const diff = curr - old;
  if (diff < 0) return chalk.green(` ↓${Math.abs(diff).toFixed(2)}`);
  return chalk.red(` ↑${diff.toFixed(2)}`);
}

wishlist
  .command("add <productId>")
  .description("Add product to wishlist")
  .option("-n, --note <note>", "Add a note")
  .action(async (productId, options) => {
    try {
      const item = await apiPost("/wishlist", {
        productId: /^\d+$/.test(productId) ? parseInt(productId) : productId,
        note: options.note,
      });
      console.log(chalk.green(`✓ Added to wishlist: ${item.product?.name || productId}`));
      if (options.note) console.log(chalk.dim(`  Note: ${options.note}`));
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first: tm login"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

wishlist
  .command("remove <productId>")
  .description("Remove from wishlist")
  .action(async (productId) => {
    try {
      await apiDelete(`/wishlist/${productId}`);
      console.log(chalk.green(`Removed from wishlist.`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

wishlist
  .command("note <productId> <note...>")
  .description("Add/update note on wishlist item")
  .action(async (productId, note) => {
    try {
      await apiPatch(`/wishlist/${productId}`, { note: note.join(' ') });
      console.log(chalk.green(`Note updated.`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

wishlist
  .command("alert <productId> <price>")
  .description("Set price drop alert")
  .action(async (productId, price) => {
    try {
      await apiPatch(`/wishlist/${productId}`, { 
        priceAlert: true,
        targetPrice: price,
      });
      console.log(chalk.green(`Price alert set for ${price}`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

program
  .command("wish")
  .description("Show wishlist (shortcut)")
  .action(async () => {
    try {
      const items = await apiGet("/wishlist");
      if (!items || items.length === 0) {
        console.log(chalk.yellow("Wishlist empty. Add: tm wishlist add <productId>"));
        return;
      }
      items.forEach((item, idx) => {
        console.log(`${idx + 1}) ${item.product?.name || item.productId} - ${item.product?.price || '?'}`);
      });
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first: tm login"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

// -----------------
// webhook - custom notifications
// -----------------
const webhook = program
  .command("webhook")
  .description("Manage custom webhook notifications");

webhook
  .command("list")
  .description("Show your webhooks")
  .action(async () => {
    try {
      const webhooks = await apiGet("/user/webhooks");
      if (!webhooks || webhooks.length === 0) {
        console.log(chalk.yellow("No webhooks configured."));
        console.log(chalk.dim("Create one: tm webhook add <name> <url> [events]"));
        return;
      }
      console.log(chalk.bold("\nYour Webhooks\n"));
      webhooks.forEach((w) => {
        const status = w.active ? chalk.green("✓") : chalk.dim("○");
        console.log(`${status} #${w.id} ${chalk.bold(w.name)}`);
        console.log(`   ${chalk.dim("URL:")} ${w.url.substring(0, 60)}${w.url.length > 60 ? "..." : ""}`);
        console.log(`   ${chalk.dim("Events:")} ${w.events.join(", ")}`);
        console.log(`   ${chalk.dim("Stats:")} ${w.totalSent} sent, ${w.totalFailed} failed`);
        console.log();
      });
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first: tm login"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

webhook
  .command("add <name> <url> [events]")
  .description("Create a new webhook")
  .action(async (name, url, events) => {
    try {
      const eventsList = events 
        ? events.split(",").map(e => e.trim())
        : ["order.created", "order.completed", "price.alert", "subscription.processed", "reward.triggered", "wishlist.price_drop"];
      
      const result = await apiPost("/user/webhooks", { name, url, events: eventsList });
      
      console.log(chalk.green(`✓ Webhook created!`));
      console.log();
      console.log(`${chalk.dim("ID:")} ${result.id}`);
      console.log(`${chalk.dim("Name:")} ${result.name}`);
      console.log(`${chalk.dim("URL:")} ${result.url}`);
      console.log(`${chalk.dim("Events:")} ${result.events.join(", ")}`);
      console.log();
      console.log(chalk.yellow("SECRET (save this - won't be shown again):"));
      console.log(chalk.bold(result.secret));
      console.log();
      console.log(chalk.dim("Test with: tm webhook test " + result.id));
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first: tm login"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

webhook
  .command("test <id>")
  .description("Send a test event to webhook")
  .action(async (id) => {
    try {
      const result = await apiPost(`/user/webhooks/${id}/test`);
      if (result.success) {
        console.log(chalk.green(`✓ Test webhook sent successfully!`));
        console.log(chalk.dim(`HTTP Status: ${result.httpStatus}`));
      } else {
        console.log(chalk.red(`✗ Test webhook failed`));
        console.log(chalk.dim(`Error: ${result.error}`));
      }
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

webhook
  .command("toggle <id>")
  .description("Enable/disable webhook")
  .action(async (id) => {
    try {
      // Get current state
      const webhooks = await apiGet("/user/webhooks");
      const hook = webhooks.find(w => w.id === parseInt(id));
      if (!hook) {
        console.log(chalk.red(`Webhook #${id} not found`));
        return;
      }
      
      await apiPatch(`/user/webhooks/${id}`, { active: !hook.active });
      console.log(chalk.green(`Webhook #${id} ${!hook.active ? "enabled" : "disabled"}`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

webhook
  .command("delete <id>")
  .description("Delete a webhook")
  .action(async (id) => {
    try {
      await apiDelete(`/user/webhooks/${id}`);
      console.log(chalk.green(`Webhook #${id} deleted`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

webhook
  .command("history <id>")
  .description("Show delivery history for a webhook")
  .action(async (id) => {
    try {
      const deliveries = await apiGet(`/user/webhooks/${id}/deliveries?limit=10`);
      if (!deliveries || deliveries.length === 0) {
        console.log(chalk.yellow(`No delivery history for webhook #${id}`));
        return;
      }
      console.log(chalk.bold(`\nDelivery History (last 10)\n`));
      deliveries.forEach((d) => {
        const status = d.status === "delivered" ? chalk.green("✓") : chalk.red("✗");
        const time = new Date(d.createdAt).toLocaleString();
        console.log(`${status} ${d.eventType} | ${d.httpStatus || "-"} | ${time}`);
        if (d.errorMessage) console.log(chalk.dim(`   Error: ${d.errorMessage}`));
      });
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
    }
  });

webhook
  .command("events")
  .description("Show available webhook events")
  .action(() => {
    console.log(chalk.bold("\nAvailable Webhook Events\n"));
    const events = {
      "order.created": "When a new order is placed",
      "order.completed": "When an order is completed",
      "price.alert": "When wishlist item price drops to target",
      "subscription.processed": "When a subscription order runs",
      "reward.triggered": "When a reward rule triggers",
      "wishlist.price_drop": "When any wishlist item price drops",
    };
    Object.entries(events).forEach(([event, desc]) => {
      console.log(`  ${chalk.cyan(event)}`);
      console.log(`    ${chalk.dim(desc)}`);
    });
    console.log();
    console.log(chalk.dim("Usage: tm webhook add <name> <url> order.created,price.alert"));
  });

program
  .command("hooks")
  .description("Show webhooks (shortcut)")
  .action(async () => {
    try {
      const webhooks = await apiGet("/user/webhooks");
      if (!webhooks || webhooks.length === 0) {
        console.log(chalk.yellow("No webhooks. Add: tm webhook add <name> <url>"));
        return;
      }
      webhooks.forEach((w) => {
        const status = w.active ? "✓" : "○";
        console.log(`${status} #${w.id} ${w.name} - ${w.events.length} events`);
      });
    } catch (e) {
      if (e?.message?.includes("401")) {
        console.log(chalk.yellow("Please login first: tm login"));
      } else {
        console.error(chalk.red(e?.message || String(e)));
      }
    }
  });

// -----------------
// merchant (seller tools)
// -----------------
const merchant = program
  .command("merchant")
  .description("Seller tools for digital products, keys, and webhooks");

merchant
  .command("init")
  .description("Initialize a free merchant store")
  .option("--name <name>", "Store name")
  .option("--description <desc>", "Store description")
  .action(async (opts) => {
    try {
      const payload = {};
      if (opts.name) payload.storeName = opts.name;
      if (opts.description) payload.description = opts.description;
      await apiPost("/merchant/init", payload);
      console.log(chalk.green("✓ Merchant store ready"));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

const merchantProduct = merchant
  .command("product")
  .description("Manage products");

merchantProduct
  .command("create")
  .description("Create a digital product")
  .requiredOption("--name <name>", "Product name")
  .requiredOption("--price <price>", "Price")
  .requiredOption("--category <category>", "Category slug")
  .requiredOption("--description <desc>", "Description")
  .option("--delivery <type>", "Delivery type: key | url | manual")
  .option("--access-url <url>", "Access URL (for url delivery)")
  .option("--checkout-url <url>", "External checkout URL (optional)")
  .action(async (opts) => {
    try {
      const payload = {
        name: opts.name,
        price: Number(opts.price),
        category: opts.category,
        description: opts.description,
        productKind: "digital",
        digitalDeliveryType: opts.delivery || undefined,
        accessUrl: opts.accessUrl || undefined,
        checkoutUrl: opts.checkoutUrl || undefined,
      };
      const result = await apiPost("/store/products", payload);
      console.log(chalk.green(`✓ Product created (#${result.id || "?"})`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

merchant
  .command("book")
  .description("Digital book shortcuts")
  .command("create")
  .description("Create a digital book (URL delivery)")
  .requiredOption("--name <name>", "Book name")
  .requiredOption("--price <price>", "Price")
  .requiredOption("--category <category>", "Category slug")
  .requiredOption("--description <desc>", "Description")
  .requiredOption("--url <url>", "Download/access URL")
  .action(async (opts) => {
    try {
      const payload = {
        name: opts.name,
        price: Number(opts.price),
        category: opts.category,
        description: opts.description,
        productKind: "digital",
        digitalDeliveryType: "url",
        accessUrl: opts.url,
      };
      const result = await apiPost("/store/products", payload);
      console.log(chalk.green(`✓ Book created (#${result.id || "?"})`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

merchant
  .command("subscription")
  .description("SaaS subscription shortcuts")
  .command("create")
  .description("Create a SaaS subscription product")
  .requiredOption("--name <name>", "Product name")
  .requiredOption("--price <price>", "Price")
  .requiredOption("--category <category>", "Category slug")
  .requiredOption("--description <desc>", "Description")
  .requiredOption("--interval <interval>", "weekly | monthly | yearly")
  .option("--access-url <url>", "Access URL")
  .option("--checkout-url <url>", "External checkout URL (optional)")
  .action(async (opts) => {
    try {
      const payload = {
        name: opts.name,
        price: Number(opts.price),
        category: opts.category,
        description: opts.description,
        productKind: "saas",
        subscriptionAvailable: true,
        offerType: "subscription",
        billingInterval: opts.interval,
        digitalDeliveryType: "url",
        accessUrl: opts.accessUrl || undefined,
        checkoutUrl: opts.checkoutUrl || undefined,
      };
      const result = await apiPost("/store/products", payload);
      console.log(chalk.green(`✓ Subscription created (#${result.id || "?"})`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

merchant
  .command("keys")
  .description("License key management")
  .command("upload")
  .description("Upload license keys for a product")
  .requiredOption("--product <id>", "Product ID")
  .option("--keys <keys>", "Comma or newline separated keys")
  .option("--file <path>", "Path to text file with keys")
  .action(async (opts) => {
    try {
      let keys = opts.keys;
      if (!keys && opts.file) {
        keys = readFileSync(opts.file, "utf-8");
      }
      if (!keys) {
        console.error(chalk.red("Provide --keys or --file"));
        process.exitCode = 1;
        return;
      }
      const result = await apiPost(`/merchant/products/${opts.product}/keys`, { keys });
      console.log(chalk.green(`✓ Keys added (${result.added || 0})`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

const merchantWebhook = merchant
  .command("webhook")
  .description("Manage seller webhooks");

merchantWebhook
  .command("add")
  .description("Create a webhook")
  .requiredOption("--name <name>", "Webhook name")
  .requiredOption("--url <url>", "Webhook URL")
  .requiredOption("--events <events>", "Comma-separated events")
  .action(async (opts) => {
    try {
      const events = String(opts.events)
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);
      const result = await apiPost("/user/webhooks", {
        name: opts.name,
        url: opts.url,
        events,
      });
      console.log(chalk.green("✓ Webhook created!"));
      if (result?.id) {
        console.log(`ID: ${result.id}`);
      }
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

merchantWebhook
  .command("list")
  .description("List your webhooks")
  .action(async () => {
    try {
      const hooks = await apiGet("/user/webhooks");
      if (!hooks || hooks.length === 0) {
        console.log(chalk.yellow("No webhooks configured."));
        return;
      }
      console.log(chalk.cyan(`🔗 Webhooks (${hooks.length})`));
      console.log();
      hooks.forEach((w, i) => {
        if (i > 0) console.log(chalk.dim("  ─────────────────────────────"));
        const status = w.active === false ? chalk.red("[disabled]") : chalk.green("[active]");
        console.log(`  ${chalk.cyan("#" + w.id)} ${chalk.bold(w.name || "Unnamed")} ${status}`);
        console.log(chalk.dim(`  URL: ${w.url}`));
        const events = Array.isArray(w.events) ? w.events.join(", ") : w.events;
        console.log(chalk.dim(`  Events: ${events}`));
      });
      console.log();
      console.log(chalk.dim("  Test: tm merchant webhook test <id>"));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

merchantWebhook
  .command("test <id>")
  .description("Send a test event to webhook")
  .action(async (id) => {
    try {
      await apiPost(`/user/webhooks/${id}/test`);
      console.log(chalk.green("✓ Test webhook sent"));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// -----------------
// categories
// -----------------
program
  .command("categories")
  .description("List categories")
  .action(async () => {
    try {
      const cats = await apiGet("/categories");
      const rows = (cats || []).map((c) => ({ 
        slug: c.slug || c,
        name: c.name || c,
        description: c.description || ""
      }));
      printTable(rows, [
        { key: "slug", title: "slug" },
        { key: "name", title: "name" },
        { key: "description", title: "description" }
      ]);
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// -----------------
// products
// -----------------
program
  .command("products")
  .description("List products")
  .option("-l, --limit <n>", "Limit results", "20")
  .option("-c, --category <category>", "Filter by category")
  .option("-s, --store <storeId>", "Filter by store ID")
  .option("--city <city>", "Filter by city (for local services)")
  .option("--country <country>", "Filter by country")
  .action(async (opts) => {
    const spinner = createSpinner("Fetching products...");
    try {
      const limit = Math.max(1, Math.min(200, Number.parseInt(opts.limit, 10) || 20));
      
      let url = "/products";
      const params = new URLSearchParams();
      
      if (opts.city) params.set("city", opts.city);
      if (opts.country) params.set("country", opts.country);
      if (opts.store) params.set("storeId", opts.store);
      
      if (opts.category) {
        url = `/products/category/${encodeURIComponent(opts.category)}`;
      }
      
      const queryString = params.toString();
      if (queryString) {
        url = `${url}?${queryString}`;
      }
      
      let products = await apiGet(url);
      stopSpinner(true, `Found ${products.length} products`);
      
      // Sort: featured first
      products = (products || []).sort((a, b) => {
        if (a.featured && !b.featured) return -1;
        if (!a.featured && b.featured) return 1;
        return 0;
      });
      
      const rows = products.slice(0, limit).map(p => {
        const row = pickProductFields(p);
        if (p.featured) {
          row.name = chalk.yellow("⭐") + " " + row.name;
          row.badge = chalk.yellow("Early partner");
        }
        return row;
      });
      
      printTable(rows, [
        { key: "id", title: "id" },
        { key: "slug", title: "slug" },
        { key: "name", title: "name" },
        { key: "price", title: "price" },
        { key: "category", title: "category" },
        { key: "serviceType", title: "type" },
        { key: "serviceCity", title: "city" },
      ]);
      
      showNextSteps([
        { cmd: "tm view <id>", desc: "view product details" },
        { cmd: "tm buy <id>", desc: "buy product" }
      ]);
    } catch (e) {
      stopSpinner(false, "Failed to load products");
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

program
  .command("category <category>")
  .description("List products in a category")
  .option("-l, --limit <n>", "Limit results", "20")
  .option("--city <city>", "Filter by city (for local services)")
  .option("--country <country>", "Filter by country")
  .action(async (category, opts) => {
    try {
      const limit = Math.max(1, Math.min(200, Number.parseInt(opts.limit, 10) || 20));
      
      const params = new URLSearchParams();
      if (opts.city) params.set("city", opts.city);
      if (opts.country) params.set("country", opts.country);
      
      const queryString = params.toString();
      let url = `/products/category/${encodeURIComponent(category)}`;
      if (queryString) {
        url = `${url}?${queryString}`;
      }
      
      const products = await apiGet(url);
      const rows = (products || []).slice(0, limit).map(pickProductFields);
      printTable(rows, [
        { key: "id", title: "id" },
        { key: "slug", title: "slug" },
        { key: "name", title: "name" },
        { key: "price", title: "price" },
        { key: "category", title: "category" },
        { key: "serviceType", title: "type" },
        { key: "serviceCity", title: "city" },
      ]);
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// Search with server-side filtering + client-side sort/head/count (pipe replacement)
program
  .command("search <query>")
  .description("Search products")
  .option("-l, --limit <n>", "Limit results", "20")
  .option("-c, --category <category>", "Filter by category")
  .option("--city <city>", "Filter by city (for local services)")
  .option("--country <country>", "Filter by country code")
  .option("--price-min <min>", "Minimum price")
  .option("--price-max <max>", "Maximum price")
  .option("--sort <field>", "Sort by field: price, name, category (prefix with - for desc, e.g. -price)")
  .option("--head <n>", "Show only first N results")
  .option("--count", "Show only result count")
  .action(async (query, opts) => {
    try {
      const limit = Math.max(1, Math.min(200, Number.parseInt(opts.limit, 10) || 20));
      
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("limit", String(opts.sort || opts.head || opts.count ? 200 : limit));
      if (opts.category) params.set("category", opts.category);
      if (opts.city) params.set("city", opts.city);
      if (opts.country) params.set("country", opts.country);
      if (opts.priceMin) params.set("price_min", opts.priceMin);
      if (opts.priceMax) params.set("price_max", opts.priceMax);
      
      const result = await apiGet(`/products/search?${params.toString()}`);
      let products = result.products || result || [];
      
      // Client-side sort (pipe replacement)
      if (opts.sort) {
        const desc = opts.sort.startsWith("-");
        const field = desc ? opts.sort.slice(1) : opts.sort;
        products = [...products].sort((a, b) => {
          let va = a[field], vb = b[field];
          if (field === "price") { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
          if (typeof va === "string") { va = va.toLowerCase(); vb = (vb || "").toLowerCase(); }
          if (va < vb) return desc ? 1 : -1;
          if (va > vb) return desc ? -1 : 1;
          return 0;
        });
      }
      
      // Client-side head
      if (opts.head) {
        products = products.slice(0, parseInt(opts.head, 10) || 5);
      }
      
      // Count mode
      if (opts.count) {
        console.log(chalk.green.bold(products.length) + chalk.dim(" result(s)"));
        return;
      }
      
      const rows = products.slice(0, limit).map(pickProductFields);
      
      printTable(rows, [
        { key: "id", title: "id" },
        { key: "slug", title: "slug" },
        { key: "name", title: "name" },
        { key: "price", title: "price" },
        { key: "category", title: "category" },
        { key: "serviceType", title: "type" },
        { key: "serviceCity", title: "city" },
      ]);
      
      if (products.length >= limit && !opts.head) {
        console.log(chalk.dim(`Showing ${limit} results. Use --limit to show more.`));
      }
    } catch (e) {
      try {
        const products = await apiGet("/products");
        const q = String(query || "").trim();
        let matched = (products || []).filter((p) => containsQuery(p, q));
        
        if (opts.category) {
          matched = matched.filter(p => p.category === opts.category);
        }
        
        const limit = Math.max(1, Math.min(200, Number.parseInt(opts.limit, 10) || 20));
        const rows = matched.slice(0, limit).map(pickProductFields);
        
        printTable(rows, [
          { key: "id", title: "id" },
          { key: "slug", title: "slug" },
          { key: "name", title: "name" },
          { key: "price", title: "price" },
          { key: "category", title: "category" },
          { key: "serviceType", title: "type" },
          { key: "serviceCity", title: "city" },
        ]);
        
        if (matched.length > limit) {
          console.log(chalk.dim(`Showing ${limit} of ${matched.length}. Use --limit to show more.`));
        }
      } catch (e2) {
        console.error(chalk.red(e2?.message || String(e2)));
        process.exitCode = 1;
      }
    }
  });

program
  .command("view <productIdOrSlug>")
  .description("View a product by ID or slug")
  .option("-i, --image", "Open product image in browser")
  .action(async (productIdOrSlug, opts) => {
    try {
      let p = await apiGet(`/products/${encodeURIComponent(productIdOrSlug)}`).catch(() => null);
      
      if (!p) {
        p = await apiGet(`/products/slug/${encodeURIComponent(productIdOrSlug)}`).catch(() => null);
      }
      
      if (!p) {
        console.error(chalk.red("Product not found"));
        process.exitCode = 1;
        return;
      }
      
      // If --image flag, open image and exit
      if (opts.image) {
        const imageUrl = p.imageUrl || p.image;
        if (imageUrl) {
          console.log(chalk.green("Opening image..."));
          if (shouldOpenExternal()) {
            try {
              await open(imageUrl);
            } catch {
              console.log(chalk.yellow("Could not open browser. Image URL:"));
              console.log(imageUrl);
            }
          } else {
            console.log(chalk.yellow("Browser opening disabled. Image URL:"));
            console.log(imageUrl);
          }
        } else {
          console.log(chalk.yellow("No image available for this product."));
        }
        return;
      }
      
      // Print beautiful product card
      printProductCard(p);
      
      try {
        const offers = await apiGet(`/products/${encodeURIComponent(p.productId || p.id)}/offers`);
        if (offers && offers.length > 0) {
          console.log("");
          console.log(chalk.bold("Available Offers:"));
          offers.forEach((offer, i) => {
            const offerType = offer.serviceType === "local" ? "📍" : 
                             offer.serviceType === "national" ? "🏳️" : "🌍";
            console.log(`  ${i + 1}. ${offerType} ${offer.priceDisplay || `$${offer.price}`} (${offer.availability}) - ${offer.buyUrl}`);
          });
        }
      } catch {
      }
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// Open product page or image in browser
program
  .command("open <productIdOrSlug>")
  .description("Open product page or image in browser")
  .option("-i, --image", "Open product image instead of page")
  .action(async (productIdOrSlug, opts) => {
    try {
      let p = await apiGet(`/products/${encodeURIComponent(productIdOrSlug)}`).catch(() => null);
      
      if (!p) {
        p = await apiGet(`/products/slug/${encodeURIComponent(productIdOrSlug)}`).catch(() => null);
      }
      
      if (!p) {
        console.error(chalk.red("Product not found"));
        process.exitCode = 1;
        return;
      }
      
      let url;
      if (opts.image) {
        url = p.imageUrl || p.image;
        if (!url) {
          console.log(chalk.yellow("No image available for this product."));
          return;
        }
      } else {
        // Open product page or buyUrl
        url = resolveProductUrl(p);
      }
      
      console.log(chalk.green("Opening:"), url);
      if (shouldOpenExternal()) {
        try {
          await open(url);
        } catch {
          console.log(chalk.yellow("Could not open browser. URL:"));
          console.log(url);
        }
      } else {
        console.log(chalk.yellow("Browser opening disabled. URL:"));
        console.log(url);
      }
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

program
  .command("buy <productIdOrSlug>")
  .description("Create intent and open product buyUrl")
  .option("--no-open", "Do not open a browser")
  .option("--offer <offerId>", "Buy specific offer")
  .action(async (productIdOrSlug, opts) => {
    try {
      let p = await apiGet(`/products/${encodeURIComponent(productIdOrSlug)}`).catch(() => null);
      
      if (!p) {
        p = await apiGet(`/products/slug/${encodeURIComponent(productIdOrSlug)}`).catch(() => null);
      }
      
      if (!p) {
        console.error(chalk.red("Product not found"));
        process.exitCode = 1;
        return;
      }

      let buyUrl = resolveProductUrl(p);
      let offerId = opts.offer ? Number(opts.offer) : null;
      
      if (offerId) {
        try {
          const offer = await apiGet(`/offers/${offerId}`);
          if (offer) {
            buyUrl = offer.buyUrl;
          }
        } catch {
          console.error(chalk.yellow("Offer not found, using product buyUrl"));
        }
      }

      let intentId = null;
      try {
        const intentResponse = await apiPost("/intents", {
          source: "cli",
          productId: p.id,
          sellerId: p.storeId ?? null,
          offerId: offerId,
        });
        intentId = intentResponse.intentId;
        
        if (intentId && buyUrl) {
          const separator = buyUrl.includes("?") ? "&" : "?";
          buyUrl = `${buyUrl}${separator}market_intent=${intentId}`;
        }
      } catch {
      }

      try {
        await apiPost("/clicks", {
          source: "cli",
          productId: p.productId,
          storeId: p.storeId ?? null,
          offerId: offerId,
          intentId: intentId,
        });
      } catch {
      }

      if (!buyUrl) {
        console.log(chalk.yellow("This product has no checkout link yet."));
        console.log(chalk.dim("This is a pilot marketplace — contact the seller directly."));
        process.exitCode = 1;
        return;
      }

      console.log();
      console.log(chalk.green.bold("  Opening checkout..."));
      console.log(chalk.dim(`  ${buyUrl}`));
      console.log();
      console.log(chalk.yellow("  ℹ Early access — real checkout, real purchase"));
      console.log();
      
      if (opts.open !== false && shouldOpenExternal()) {
        await open(buyUrl);
      }
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// -----------------
// book (services)
// -----------------
program
  .command("book <serviceIdOrSlug>")
  .description("Book a service")
  .option("--date <date>", "Booking date (YYYY-MM-DD)")
  .option("--time <time>", "Booking time (HH:MM)")
  .option("--notes <notes>", "Additional notes")
  .action(async (serviceIdOrSlug, opts) => {
    try {
      // Fetch product
      let p = await apiGet(`/products/${encodeURIComponent(serviceIdOrSlug)}`).catch(() => null);
      
      if (!p) {
        p = await apiGet(`/products/slug/${encodeURIComponent(serviceIdOrSlug)}`).catch(() => null);
      }
      
      if (!p) {
        console.error(chalk.red("Service not found"));
        process.exitCode = 1;
        return;
      }
      
      // Verify this is a service
      if (p.productKind !== 'service') {
        console.error(chalk.red("This is not a service. Use 'tm buy' for products."));
        process.exitCode = 1;
        return;
      }
      
      const buyUrl = p.checkoutUrl || p.buyUrl;
      if (!buyUrl) {
        console.log(chalk.yellow("This service has no checkout link yet."));
        process.exitCode = 1;
        return;
      }
      
      // Create booking intent
      const intentResponse = await apiPost("/intents", {
        source: "cli",
        productId: p.id,
        sellerId: p.storeId ?? null,
        checkoutUrl: buyUrl,
        orderType: "service",
        bookingDate: opts.date,
        bookingTime: opts.time,
        bookingNotes: opts.notes,
      });
      
      let intentId = intentResponse.intentId ?? null;
      let redirectUrl = buyUrl;
      
      if (intentResponse.redirectUrl) {
        redirectUrl = intentResponse.redirectUrl;
      } else if (intentId) {
        const sep = buyUrl.includes("?") ? "&" : "?";
        redirectUrl = `${buyUrl}${sep}tm_intent=${intentId}`;
      }
      
      console.log();
      console.log(chalk.green.bold("  Opening booking..."));
      console.log(chalk.dim(`  ${p.name}`));
      if (opts.date) console.log(chalk.dim(`  Date: ${opts.date}`));
      if (opts.time) console.log(chalk.dim(`  Time: ${opts.time}`));
      console.log(chalk.dim(`  ${redirectUrl}`));
      console.log();
      
      if (shouldOpenExternal()) {
        await open(redirectUrl);
      }
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// -----------------
// sellers
// -----------------
program
  .command("sellers")
  .alias("stores")
  .description("List verified sellers/stores")
  .option("-l, --limit <n>", "Limit results", "20")
  .option("--all", "Show all sellers (not just verified)")
  .option("--city <city>", "Filter by city (local sellers)")
  .option("--country <country>", "Filter by country")
  .action(async (opts) => {
    try {
      const limit = Math.max(1, Math.min(200, Number.parseInt(opts.limit, 10) || 20));
      const endpoint = opts.all ? "/sellers" : "/sellers/verified";
      let sellers = await apiGet(endpoint);
      
      if (opts.city) {
        sellers = sellers.filter(s => 
          s.serviceType === "local" && 
          s.baseCity?.toLowerCase() === opts.city.toLowerCase()
        );
      }
      if (opts.country) {
        sellers = sellers.filter(s => 
          (s.serviceType === "national" || s.serviceType === "local") && 
          s.baseCountry?.toLowerCase() === opts.country.toLowerCase()
        );
      }
      
      printSellers((sellers || []).slice(0, limit));
    } catch (e) {
      printError(e?.message || String(e));
      process.exitCode = 1;
    }
  });

program
  .command("seller <slug>")
  .description("View seller details")
  .action(async (slug) => {
    try {
      const seller = await apiGet(`/sellers/${encodeURIComponent(slug)}`);
      
      if (!seller) {
        printError("Seller not found");
        process.exitCode = 1;
        return;
      }
      
      printStoreCard(seller);
    } catch (e) {
      printError(e?.message || String(e));
      process.exitCode = 1;
    }
  });

// -----------------
// offers
// -----------------
program
  .command("offers")
  .description("List offers")
  .option("-p, --product <productId>", "Filter by product ID")
  .option("-s, --seller <sellerId>", "Filter by seller ID")
  .option("-l, --limit <n>", "Limit results", "20")
  .action(async (opts) => {
    try {
      const limit = Math.max(1, Math.min(200, Number.parseInt(opts.limit, 10) || 20));
      const params = new URLSearchParams();
      if (opts.product) params.set("product_id", opts.product);
      if (opts.seller) params.set("seller_id", opts.seller);
      
      const queryString = params.toString();
      const endpoint = queryString ? `/offers?${queryString}` : "/offers";
      
      const offers = await apiGet(endpoint);
      const rows = (offers || []).slice(0, limit).map(pickOfferFields);
      printTable(rows, [
        { key: "id", title: "id" },
        { key: "price", title: "price" },
        { key: "serviceType", title: "type" },
        { key: "availability", title: "status" },
        { key: "sellerId", title: "seller" },
      ]);
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// -----------------
// info commands
// -----------------
program
  .command("about")
  .description("About TerminalMarket")
  .action(() => {
    const W = 40;
    const line = '═'.repeat(W);
    const pad = (s, w) => s + ' '.repeat(Math.max(0, w - s.length));
    
    console.log();
    console.log(chalk.green.bold('  ╔' + line + '╗'));
    console.log(chalk.green.bold('  ║') + chalk.white.bold(pad('       TERMINAL MARKET', W)) + chalk.green.bold('║'));
    console.log(chalk.green.bold('  ║') + chalk.dim(pad('   The marketplace for developers', W)) + chalk.green.bold('║'));
    console.log(chalk.green.bold('  ╚' + line + '╝'));
    console.log();
    console.log(chalk.white('  We connect developers with premium services:'));
    console.log();
    console.log(chalk.cyan('    ☕') + chalk.white(' Coffee subscriptions'));
    console.log(chalk.cyan('    🥗') + chalk.white(' Healthy snacks & lunch'));
    console.log(chalk.cyan('    💆') + chalk.white(' Health & wellness services'));
    console.log(chalk.cyan('    🏢') + chalk.white(' Coworking spaces'));
    console.log(chalk.cyan('    🤖') + chalk.white(' AI services & tools'));
    console.log(chalk.cyan('    ⚡') + chalk.white(' Productivity tools'));
    console.log();
    console.log(chalk.dim('  ─────────────────────────────────────────────'));
    console.log();
    console.log(chalk.white('  Install:'));
    console.log();
    console.log(`    ${chalk.dim('npm:')}    ${chalk.green('npm i -g terminalmarket')}`);
    console.log(`    ${chalk.dim('curl:')}   ${chalk.cyan('curl -fsSL https://terminalmarket.app/install.sh | sh')}`);
    console.log();
    console.log(chalk.dim('  ─────────────────────────────────────────────'));
    console.log();
    console.log(`  ${chalk.dim('Website:')}  ${chalk.cyan('https://terminalmarket.app')}`);
    console.log(`  ${chalk.dim('Version:')}  ${chalk.white('0.7.2')}`);
    console.log();
  });

program
  .command("stats")
  .description("Market statistics")
  .action(async () => {
    try {
      const stats = await apiGet("/stats");
      
      console.log();
      console.log(chalk.green.bold('  📊 Market Statistics'));
      console.log(chalk.dim('  ─────────────────────────────────────────'));
      console.log();
      console.log(`  ${chalk.dim('Total Sellers:')}  ${chalk.white(stats.totalSellers || 0)}`);
      console.log(`  ${chalk.dim('Total Products:')} ${chalk.white(stats.totalProducts || 0)}`);
      console.log(`  ${chalk.dim('Countries:')}      ${chalk.white(stats.countries || 0)}`);
      console.log(`  ${chalk.dim('Categories:')}     ${chalk.white(stats.categories || 0)}`);
      console.log();
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

program
  .command("policy")
  .alias("terms")
  .description("Terms of service")
  .action(() => {
    console.log();
    console.log(chalk.green.bold('  📜 Terms of Service'));
    console.log(chalk.dim('  ─────────────────────────────────────────'));
    console.log();
    console.log(chalk.white('  Platform Role:'));
    console.log(chalk.dim('    TerminalMarket connects buyers with independent sellers.'));
    console.log(chalk.dim('    We facilitate the connection but don\'t sell directly.'));
    console.log();
    console.log(chalk.white('  Seller Responsibility:'));
    console.log(chalk.dim('    • Product quality and accuracy'));
    console.log(chalk.dim('    • Order fulfillment and shipping'));
    console.log(chalk.dim('    • Customer service and support'));
    console.log(chalk.dim('    • Refunds (per their own policies)'));
    console.log();
    console.log(chalk.white('  Buyer Rights:'));
    console.log(chalk.dim('    • Contact sellers directly for issues'));
    console.log(chalk.dim('    • Report problematic sellers'));
    console.log(chalk.dim('    • Leave honest reviews'));
    console.log();
  });

program
  .command("privacy")
  .description("Privacy policy")
  .action(() => {
    console.log();
    console.log(chalk.green.bold('  🔒 Privacy Policy'));
    console.log(chalk.dim('  ─────────────────────────────────────────'));
    console.log();
    console.log(chalk.white('  Data We Collect:'));
    console.log(chalk.dim('    • Account information (email, username)'));
    console.log(chalk.dim('    • Order history and preferences'));
    console.log(chalk.dim('    • Usage data for platform improvement'));
    console.log();
    console.log(chalk.white('  Data We Share:'));
    console.log(chalk.dim('    • Order details with sellers for fulfillment'));
    console.log(chalk.dim('    • Payment info with Stripe'));
    console.log(chalk.dim('    • We never sell your data'));
    console.log();
    console.log(chalk.white('  Your Rights:'));
    console.log(chalk.dim('    • Request a copy of your data'));
    console.log(chalk.dim('    • Delete your account'));
    console.log(chalk.dim('    • Opt out of marketing'));
    console.log();
  });

program
  .command("faq")
  .description("Frequently asked questions")
  .action(() => {
    console.log();
    console.log(chalk.green.bold('  ❓ FAQ'));
    console.log(chalk.dim('  ─────────────────────────────────────────'));
    console.log();
    console.log(chalk.cyan('  Q: Is TerminalMarket free to use?'));
    console.log(chalk.dim('  A: Yes! Browsing and buying is free. We charge sellers a commission.'));
    console.log();
    console.log(chalk.cyan('  Q: Who do I contact if my order has issues?'));
    console.log(chalk.dim('  A: Contact the seller first. If unresponsive, email support@terminalmarket.app'));
    console.log();
    console.log(chalk.cyan('  Q: How are sellers verified?'));
    console.log(chalk.dim('  A: We verify identity and payment info. Look for the verified badge.'));
    console.log();
    console.log(chalk.cyan('  Q: Can I get a refund?'));
    console.log(chalk.dim('  A: Refund policies are set by sellers. Check product listing before buying.'));
    console.log();
    console.log(chalk.cyan('  Q: How do I become a seller?'));
    console.log(chalk.dim('  A: Visit the merchant portal. We offer Free, Basic, and Premium tiers.'));
    console.log();
  });

program
  .command("contact")
  .alias("support")
  .description("Contact & support")
  .action(() => {
    console.log();
    console.log(chalk.green.bold('  📞 Contact & Support'));
    console.log(chalk.dim('  ─────────────────────────────────────────'));
    console.log();
    console.log(chalk.white('  For Order Issues:'));
    console.log(chalk.dim('    Contact the seller directly first.'));
    console.log();
    console.log(chalk.white('  For Platform Issues:'));
    console.log(chalk.dim('    Email: support@terminalmarket.app'));
    console.log();
    console.log(chalk.white('  For Sellers:'));
    console.log(chalk.dim('    Email: merchants@terminalmarket.app'));
    console.log();
    console.log(chalk.dim('  Response time: 24-48 hours on business days'));
    console.log();
  });

// -----------------
// help
// -----------------

// Command groups for organized help
const commandGroups = {
  'Authentication': ['login', 'logout', 'register', 'auth', 'whoami', 'profile'],
  'Shopping': ['featured', 'deals', 'products', 'search', 'view', 'buy', 'book', 'open', 'categories'],
  'Cart & Orders': ['cart', 'add', 'checkout', 'orders'],
  'Reverse Marketplace': ['request'],
  'Automation': ['watch', 'telegram'],
  'Developer Jobs': ['jobs', 'job', 'apply', 'applications'],
  'Stores': ['sellers', 'store', 'reviews', 'where'],
  'AI Services': ['ai', 'credits', 'topup'],
  'On-Demand Tasks': ['tasks', 'task'],
  'Personalization': ['alias', 'reward'],
  'Info': ['about', 'stats', 'policy', 'privacy', 'faq', 'contact'],
  'System': ['start', 'doctor', 'config', 'help']
};

// Command groups by level
const basicGroups = {
  'Get Started': ['start', 'where', 'doctor'],
  'Shop': ['featured', 'deals', 'products', 'search', 'buy', 'book', 'view', 'open'],
  'Account': ['login', 'register', 'whoami', 'profile']
};

const advancedGroups = {
  'Cart & Orders': ['cart', 'add', 'checkout', 'orders'],
  'Reverse Marketplace': ['request'],
  'AI Services': ['ai', 'credits', 'topup'],
  'Stores': ['sellers', 'store', 'reviews'],
  'Automation': ['watch', 'telegram', 'alias', 'reward', 'subscribe', 'wishlist', 'webhook']
};

// Custom help formatter
function showHelp(commandName = null, mode = 'basic') {
  if (commandName) {
    // Show detailed help for specific command
    const cmd = program.commands.find(c => c.name() === commandName);
    if (!cmd) {
      console.log(chalk.red(`✗ Unknown command: ${commandName}`));
      console.log(chalk.dim(`Run 'tm help' to see all commands.`));
      return;
    }
    
    console.log();
    console.log(chalk.cyan('━'.repeat(50)));
    console.log(chalk.green.bold(`  tm ${cmd.name()}`));
    console.log(chalk.white(`  ${cmd.description()}`));
    console.log(chalk.cyan('━'.repeat(50)));
    console.log();
    
    // Show usage
    const args = cmd.registeredArguments || [];
    const argsStr = args.map(a => a.required ? chalk.yellow(`<${a.name()}>`) : chalk.dim(`[${a.name()}]`)).join(' ');
    console.log(chalk.magenta.bold('Usage:'));
    console.log(`  ${chalk.green('tm')} ${chalk.cyan(cmd.name())}${argsStr ? ' ' + argsStr : ''} ${chalk.dim('[options]')}`);
    console.log();
    
    // Show arguments
    if (args.length > 0) {
      console.log(chalk.magenta.bold('Arguments:'));
      args.forEach(a => {
        const req = a.required ? chalk.yellow('(required)') : chalk.dim('(optional)');
        console.log(`  ${chalk.cyan(a.name().padEnd(15))} ${req}`);
      });
      console.log();
    }
    
    // Show options
    const opts = cmd.options;
    if (opts.length > 0) {
      console.log(chalk.magenta.bold('Options:'));
      opts.forEach(o => {
        const flags = chalk.yellow(o.flags.padEnd(28));
        console.log(`  ${flags} ${chalk.white(o.description)}`);
      });
      console.log();
    }
    
    // Show subcommands if any
    if (cmd.commands && cmd.commands.length > 0) {
      console.log(chalk.magenta.bold('Subcommands:'));
      cmd.commands.sort((a, b) => a.name().localeCompare(b.name())).forEach(sub => {
        const subArgs = (sub.registeredArguments || []).map(a => a.required ? chalk.yellow(`<${a.name()}>`) : chalk.dim(`[${a.name()}]`)).join(' ');
        const cmdPart = chalk.cyan(sub.name()) + (subArgs ? ' ' + subArgs : '');
        console.log(`  ${cmdPart.padEnd(40)} ${chalk.white(sub.description())}`);
      });
      console.log();
      console.log(chalk.dim(`  💡 Run 'tm ${cmd.name()} <subcommand> help' for more details.`));
    }
    console.log();
    return;
  }
  
  // Collect all commands
  const allCommands = {};
  program.commands.forEach(cmd => {
    const args = (cmd.registeredArguments || []).map(a => a.required ? `<${a.name()}>` : `[${a.name()}]`).join(' ');
    allCommands[cmd.name()] = {
      name: cmd.name(),
      args,
      desc: cmd.description()
    };
  });
  
  const COL_WIDTH = 28;
  
  const printGroup = (groupName, cmdNames, icon, color) => {
    const groupCmds = cmdNames
      .filter(name => allCommands[name])
      .map(name => allCommands[name]);
    
    if (groupCmds.length === 0) return;
    
    console.log(color.bold(`${icon} ${groupName}`));
    groupCmds.forEach(c => {
      const rawCmd = c.name + (c.args ? ' ' + c.args : '');
      console.log('  ' + chalk.cyan(c.name) + (c.args ? chalk.yellow(' ' + c.args) : '') + 
                  ' '.repeat(Math.max(1, COL_WIDTH - rawCmd.length)) + 
                  chalk.dim(c.desc));
    });
    console.log();
  };
  
  console.log();
  console.log(chalk.green.bold('  TerminalMarket') + chalk.dim(` v${VERSION}`));
  console.log(chalk.dim('  The marketplace for developers'));
  console.log();
  
  if (mode === 'basic') {
    // Simple, selling help
    console.log(chalk.yellow.bold('Quick Start:'));
    console.log(`  ${chalk.green('tm start')}            ${chalk.dim('interactive onboarding')}`);
    console.log(`  ${chalk.green('tm where <city>')}     ${chalk.dim('set your location')}`);
    console.log(`  ${chalk.green('tm featured')}         ${chalk.dim('top picks this week')}`);
    console.log(`  ${chalk.green('tm buy <id>')}         ${chalk.dim('purchase a product')}`);
    console.log();
    
    printGroup('Shop', ['featured', 'deals', 'search', 'products'], '🛒', chalk.green);
    printGroup('Account', ['login', 'register', 'profile'], '👤', chalk.blue);
    printGroup('Help', ['doctor', 'help'], '💡', chalk.gray);
    
    console.log(chalk.dim('─'.repeat(45)));
    console.log(chalk.dim('  tm help --advanced') + chalk.dim('  cart, AI, rewards'));
    console.log(chalk.dim('  tm help --all') + chalk.dim('       full command list'));
    console.log();
    
  } else if (mode === 'advanced') {
    // Advanced features
    console.log(chalk.yellow.bold('Advanced Features:'));
    console.log();
    
    printGroup('Cart & Orders', ['cart', 'add', 'checkout', 'orders'], '📦', chalk.yellow);
    printGroup('Reverse Marketplace', ['request'], '📋', chalk.magenta);
    printGroup('AI Services', ['ai', 'credits', 'topup'], '🤖', chalk.cyan);
    printGroup('Stores', ['sellers', 'store', 'reviews'], '🏪', chalk.magenta);
    printGroup('Automation', ['watch', 'telegram', 'alias', 'reward', 'subscribe', 'wishlist'], '👁', chalk.cyan);
    
    console.log(chalk.dim('─'.repeat(45)));
    console.log(chalk.dim('  tm help') + chalk.dim('            basic commands'));
    console.log(chalk.dim('  tm help --all') + chalk.dim('       full list'));
    console.log();
    
  } else {
    // Full list (--all)
    console.log(chalk.magenta.bold('Usage:'), chalk.green('tm'), chalk.cyan('<command>'), chalk.dim('[options]'));
    console.log();
    
    const groupColors = {
      'Authentication': chalk.blue,
      'Shopping': chalk.green,
      'Cart & Orders': chalk.yellow,
      'Reverse Marketplace': chalk.magenta,
      'Automation': chalk.cyan,
      'Developer Jobs': chalk.magenta,
      'Stores': chalk.cyan,
      'AI Services': chalk.cyan,
      'On-Demand Tasks': chalk.yellow,
      'Personalization': chalk.white,
      'Info': chalk.dim,
      'System': chalk.gray
    };
    
    const groupIcons = {
      'Authentication': '🔐',
      'Shopping': '🛒',
      'Cart & Orders': '📦',
      'Reverse Marketplace': '📋',
      'Automation': '👁',
      'Developer Jobs': '💼',
      'Stores': '🏪',
      'AI Services': '🤖',
      'On-Demand Tasks': '⚡',
      'Personalization': '⚙️',
      'Info': 'ℹ️',
      'System': '💻'
    };
    
    for (const [group, cmdNames] of Object.entries(commandGroups)) {
      printGroup(group, cmdNames, groupIcons[group] || '•', groupColors[group] || chalk.white);
    }
    
    console.log(chalk.dim('─'.repeat(45)));
    console.log(chalk.dim('  tm help <command>') + chalk.dim('   detailed help'));
    console.log();
  }
}

program
  .command("where [city]")
  .description("Set or view your location (for local services)")
  .action(async (city) => {
    if (city) {
      setLocation(city);
      showSuccess(`Location set to ${city}`);
      showNextSteps([
        { cmd: "tm products", desc: "browse products in " + city },
        { cmd: "tm search lunch", desc: "find lunch options" }
      ]);
    } else {
      const location = getLocation();
      if (location?.city) {
        console.log();
        console.log(chalk.green("  📍 Location: ") + chalk.white.bold(location.city));
        console.log();
        console.log(chalk.dim("  💡 tm where <city> — change location"));
        console.log();
      } else {
        console.log();
        console.log(chalk.dim("  📍 Location not set"));
        console.log();
        console.log(chalk.dim("  💡 Set location for local services:"));
        console.log(chalk.cyan("     tm where berlin"));
        console.log(chalk.cyan("     tm where prague"));
        console.log();
      }
    }
  });

program
  .command("start")
  .alias("tour")
  .description("Interactive onboarding tour")
  .action(async () => {
    console.log();
    console.log(chalk.green.bold("  Welcome to TerminalMarket! 🚀"));
    console.log(chalk.dim("  Let's get you started with a quick tour."));
    console.log();
    let city = "Berlin";
    let action = "all";
    if (shouldPrompt()) {
      const inquirer = await import("inquirer").then(m => m.default);
      const cityAnswer = await inquirer.prompt([
        {
          type: "input",
          name: "city",
          message: "What city are you in?",
          default: "Berlin"
        }
      ]);
      city = cityAnswer.city || city;
      const actionAnswer = await inquirer.prompt([
        {
          type: "list",
          name: "action",
          message: "What would you like to explore?",
          choices: [
            { name: "🍽  Food & Drinks", value: "food" },
            { name: "🤖  AI Services", value: "ai" },
            { name: "🏢  Coworking Spaces", value: "coworking" },
            { name: "🛠  Developer Tools", value: "digital" },
            { name: "📦  Browse all products", value: "all" }
          ]
        }
      ]);
      action = actionAnswer.action || action;
    }
    
    setLocation(city);
    console.log(chalk.green(`  ✓ Location set to ${city}`));
    console.log();
    
    const spinner = createSpinner("Fetching products...");
    
    try {
      let products;
      if (action === "all") {
        products = await apiGet("/products");
      } else if (action === "ai") {
        stopSpinner(true, "AI models");
        const models = await apiGet("/ai/models");
        printAIModels(models);
        showNextSteps([
          { cmd: "tm ai topup 10", desc: "add $10 credits" },
          { cmd: "tm ai run <model> <prompt>", desc: "run an AI model" }
        ]);
        return;
      } else {
        products = await apiGet(`/products/category/${action}`);
      }
      
      stopSpinner(true, `Found ${products.length} products`);
      
      if (products.length > 0) {
        const rows = products.slice(0, 5).map(pickProductFields);
        printTable(rows, [
          { key: "id", title: "ID" },
          { key: "name", title: "Name" },
          { key: "price", title: "Price" },
          { key: "category", title: "Category" }
        ]);
      }
      
      console.log();
      console.log(chalk.green.bold("  You're all set! 🎉"));
      console.log();
      console.log(chalk.dim("  Try:"));
      console.log(chalk.cyan("    tm products"));
      console.log(chalk.cyan("    tm buy <id>"));
      console.log();
      
    } catch (e) {
      stopSpinner(false, "Failed to load");
      printError(e?.message || String(e));
    }
  });

program
  .command("featured")
  .alias("best")
  .description("Top picks this week (by city + global)")
  .action(async () => {
    const spinner = createSpinner("Loading featured products...");
    try {
      const location = getLocation();
      let products = await apiGet("/products");
      
      // Featured first, then by city
      const featured = products.filter(p => p.featured);
      const local = location?.city 
        ? products.filter(p => !p.featured && p.city?.toLowerCase() === location.city.toLowerCase())
        : [];
      const global = products.filter(p => !p.featured && p.serviceType === "global").slice(0, 5);
      
      const combined = [...featured, ...local, ...global].slice(0, 10);
      
      stopSpinner(true, `${combined.length} top picks`);
      
      if (combined.length === 0) {
        printEmpty("No featured products yet");
        return;
      }
      
      console.log();
      console.log(chalk.green.bold("  ⭐ Featured This Week"));
      console.log(chalk.dim("  ─".repeat(25)));
      console.log();
      
      combined.forEach((p, i) => {
        const badge = p.featured ? chalk.yellow(" ★") : "";
        const loc = p.city ? chalk.dim(` 📍 ${p.city}`) : "";
        console.log(`  ${chalk.dim(`${i + 1}.`)} ${chalk.white(p.name)}${badge}${loc}`);
        console.log(`     ${chalk.green(`$${p.price}`)} ${chalk.dim("—")} ${chalk.dim(p.description?.slice(0, 40) || "")}`);
        console.log();
      });
      
      showNextSteps([
        { cmd: "tm buy <id>", desc: "purchase a product" },
        { cmd: "tm view <id>", desc: "see details" }
      ]);
    } catch (e) {
      stopSpinner(false, "Failed");
      printError(e?.message || String(e));
    }
  });

program
  .command("deals")
  .description("Best deals and curated offers")
  .action(async () => {
    const spinner = createSpinner("Finding best deals...");
    try {
      const products = await apiGet("/products");
      
      // Sort by featured, then by price (lowest first for deals)
      const sorted = [...products]
        .sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0) || a.price - b.price)
        .slice(0, 10);
      
      stopSpinner(true, `${sorted.length} deals found`);
      
      console.log();
      console.log(chalk.green.bold("  🔥 Best Deals"));
      console.log(chalk.dim("  ─".repeat(25)));
      console.log();
      
      sorted.forEach((p, i) => {
        const badge = p.featured ? chalk.yellow(" ★ Featured") : "";
        console.log(`  ${chalk.dim(`${i + 1}.`)} ${chalk.white(p.name)}${badge}`);
        console.log(`     ${chalk.green.bold(`$${p.price}`)} ${chalk.dim(p.category || "")}`);
        console.log();
      });
      
      showNextSteps([
        { cmd: "tm buy <id>", desc: "purchase now" }
      ]);
    } catch (e) {
      stopSpinner(false, "Failed");
      printError(e?.message || String(e));
    }
  });

program
  .command("doctor")
  .description("Check CLI health and configuration")
  .action(async () => {
    console.log();
    console.log(chalk.green.bold("  🩺 TerminalMarket Doctor"));
    console.log(chalk.dim("  ─".repeat(25)));
    console.log();
    
    let issues = 0;
    
    // Check API
    const apiBase = getApiBase();
    console.log(chalk.white("  API Endpoint:"));
    console.log(`    ${chalk.dim(apiBase)}`);
    
    const spinner = createSpinner("Testing API connection...");
    try {
      await apiGet("/categories");
      stopSpinner(true, "API is reachable");
    } catch (e) {
      stopSpinner(false, "API unreachable");
      console.log(chalk.red(`    ✗ ${e?.message || "Connection failed"}`));
      console.log(chalk.dim("    💡 Check your internet or run: tm config set api <url>"));
      issues++;
    }
    
    // Check auth
    console.log();
    console.log(chalk.white("  Authentication:"));
    try {
      const status = await apiGet("/auth/status");
      if (status.isAuthenticated && status.user) {
        console.log(chalk.green(`    ✓ Logged in as ${status.user.email}`));
      } else {
        console.log(chalk.yellow(`    ○ Not logged in`));
        console.log(chalk.dim("    💡 Run: tm login <email>"));
      }
    } catch {
      console.log(chalk.yellow(`    ○ Could not check auth status`));
    }
    
    // Check location
    console.log();
    console.log(chalk.white("  Location:"));
    const location = getLocation();
    if (location?.city) {
      console.log(chalk.green(`    ✓ Set to ${location.city}`));
    } else {
      console.log(chalk.yellow(`    ○ Not set (local services hidden)`));
      console.log(chalk.dim("    💡 Run: tm where <city>"));
      issues++;
    }
    
    // Summary
    console.log();
    console.log(chalk.dim("  ─".repeat(25)));
    if (issues === 0) {
      console.log(chalk.green.bold("  ✓ All checks passed!"));
    } else {
      console.log(chalk.yellow(`  ⚠ ${issues} issue${issues > 1 ? "s" : ""} found`));
    }
    console.log();
  });

// -----------------
// Library Commands (Digital Products)
// -----------------
const library = program
  .command("library")
  .alias("lib")
  .description("Your digital purchases & subscriptions");

library
  .command("list")
  .description("List all your digital purchases")
  .action(async () => {
    try {
      const data = await apiGet("/library");
      
      if (!data.purchases?.length && !data.subscriptions?.length) {
        showInfoBox("Your library is empty", "Purchase digital products to see them here\n💡 Run: tm list --kind digital");
        return;
      }
      
      if (data.purchases?.length) {
        showSection("Digital Purchases");
        console.log(chalk.dim("  ID     Product                Type      Status    Purchased"));
        console.log(chalk.dim("  ─".repeat(35)));
        
        for (const p of data.purchases) {
          const date = new Date(p.createdAt).toLocaleDateString();
          const status = p.status === 'active' ? chalk.green('active') : chalk.red(p.status);
          const type = p.licenseKey ? 'key' : p.fileStoragePath ? 'file' : p.accessUrl ? 'link' : 'manual';
          console.log(`  ${chalk.cyan(String(p.id).padEnd(6))} ${(p.productName || 'Unknown').padEnd(22).substring(0, 22)} ${type.padEnd(9)} ${status.padEnd(9)} ${date}`);
        }
      }
      
      if (data.subscriptions?.length) {
        console.log();
        showSection("SaaS Subscriptions");
        console.log(chalk.dim("  ID     Product                Status      Renews"));
        console.log(chalk.dim("  ─".repeat(35)));
        
        for (const s of data.subscriptions) {
          const renewDate = s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '-';
          const statusColor = s.status === 'active' ? chalk.green : s.status === 'canceled' ? chalk.red : chalk.yellow;
          console.log(`  ${chalk.cyan(String(s.id).padEnd(6))} ${(s.productName || 'Unknown').padEnd(22).substring(0, 22)} ${statusColor(s.status.padEnd(11))} ${renewDate}`);
        }
      }
      
      console.log();
      showNextSteps([
        { cmd: "tm keys", desc: "show your license keys" },
        { cmd: "tm download <id>", desc: "download file for purchase" }
      ]);
    } catch (error) {
      showError(error.message || "Failed to fetch library");
    }
  });

program
  .command("keys")
  .description("Show your license keys")
  .action(async () => {
    try {
      const data = await apiGet("/library/keys");
      
      if (!data?.length) {
        showInfoBox("No license keys", "You haven't purchased any products with license keys yet");
        return;
      }
      
      showSection("Your License Keys");
      console.log(chalk.dim("  Product                    Key"));
      console.log(chalk.dim("  ─".repeat(35)));
      
      for (const p of data) {
        console.log(`  ${(p.productName || 'Unknown').padEnd(28).substring(0, 28)} ${chalk.green(p.licenseKey)}`);
      }
      
      console.log();
      showInfo("Keys are yours forever. Copy and use them with the respective products.");
    } catch (error) {
      showError(error.message || "Failed to fetch keys");
    }
  });

program
  .command("download <purchaseId>")
  .alias("dl")
  .description("Download a digital file purchase")
  .action(async (purchaseId) => {
    const spinner = createSpinner("Preparing download...");
    
    try {
      const fs = await import("fs");
      const path = await import("path");
      const https = await import("https");
      const http = await import("http");
      const { getApiBase } = await import("../src/config.js");
      const { getCookies } = await import("../src/api.js");
      
      const baseUrl = getApiBase();
      const url = `${baseUrl}/library/download/${purchaseId}`;
      
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      
      updateSpinner(spinner, "Downloading...");
      
      const cookies = getCookies();
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname,
        method: 'GET',
        headers: {
          'Cookie': cookies || '',
        }
      };
      
      const req = protocol.request(options, (response) => {
        if (response.statusCode === 401) {
          stopSpinner(spinner);
          showError("Login required. Run: tm login <email>");
          return;
        }
        
        if (response.statusCode === 404) {
          stopSpinner(spinner);
          showError("Purchase not found or no file available");
          return;
        }
        
        if (response.statusCode !== 200) {
          stopSpinner(spinner);
          showError(`Download failed (status ${response.statusCode})`);
          return;
        }
        
        const contentDisposition = response.headers['content-disposition'];
        let filename = `download_${purchaseId}`;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^";\n]+)"?/);
          if (match) filename = match[1];
        }
        
        const filePath = path.join(process.cwd(), filename);
        const fileStream = fs.createWriteStream(filePath);
        
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          stopSpinner(spinner);
          showSuccessBox("Download complete", `Saved to: ${filename}`);
        });
        
        fileStream.on('error', (err) => {
          stopSpinner(spinner);
          showError(`Failed to save file: ${err.message}`);
        });
      });
      
      req.on('error', (err) => {
        stopSpinner(spinner);
        showError(`Download failed: ${err.message}`);
      });
      
      req.end();
    } catch (error) {
      stopSpinner(spinner);
      showError(error.message || "Download failed");
    }
  });

// -----------------
// Tasks Commands (On-Demand Services) - renamed from "jobs"
// -----------------
const tasks = program
  .command("tasks")
  .description("Your on-demand service tasks");

tasks
  .command("list")
  .description("List all your tasks")
  .action(async () => {
    try {
      const spinner = createSpinner("Fetching tasks...");
      const data = await apiGet("/jobs");
      stopSpinner(spinner);
      
      if (!data?.length) {
        showInfoBox("No tasks yet", "Purchase on-demand services to see your tasks here\n💡 On-demand services execute tasks for you (SEO audits, code conversions, etc.)");
        return;
      }
      
      showSection("Your Tasks");
      console.log(chalk.dim("  Task ID                      Service               Status       Created"));
      console.log(chalk.dim("  ─".repeat(40)));
      
      for (const task of data) {
        const statusIcon = {
          'pending_payment': chalk.yellow("⏳"),
          'queued': chalk.blue("📋"),
          'dispatching': chalk.blue("🚀"),
          'dispatched': chalk.cyan("⏳"),
          'completed': chalk.green("✓"),
          'failed': chalk.red("✗"),
        }[task.status] || "•";
        
        const statusColor = {
          'pending_payment': chalk.yellow,
          'queued': chalk.blue,
          'dispatching': chalk.blue,
          'dispatched': chalk.cyan,
          'completed': chalk.green,
          'failed': chalk.red,
        }[task.status] || chalk.gray;
        
        const date = new Date(task.createdAt).toLocaleDateString();
        console.log(`  ${statusIcon} ${chalk.white(task.jobId.padEnd(26))} ${chalk.cyan((task.productName || 'Unknown').substring(0, 20).padEnd(20))} ${statusColor(task.status.padEnd(12))} ${chalk.dim(date)}`);
      }
      
      console.log();
      showNextSteps([
        { cmd: "tm task <task_id>", desc: "view task details and results" }
      ]);
    } catch (error) {
      showError(error.message || "Failed to fetch tasks");
    }
  });

program
  .command("task <taskId>")
  .description("View task details and results")
  .action(async (taskId) => {
    try {
      const spinner = createSpinner("Fetching task details...");
      const task = await apiGet(`/jobs/${taskId}`);
      stopSpinner(spinner);
      
      showSection(`Task: ${task.jobId}`);
      console.log();
      
      const statusIcon = {
        'pending_payment': '⏳ Pending Payment',
        'queued': '📋 Queued',
        'dispatching': '🚀 Dispatching',
        'dispatched': '⏳ Waiting for Result',
        'completed': '✅ Completed',
        'failed': '❌ Failed',
      }[task.status] || task.status;
      
      console.log(`  ${chalk.dim("Service:")} ${chalk.white(task.productName || 'Unknown')}`);
      console.log(`  ${chalk.dim("Status:")}  ${task.status === 'completed' ? chalk.green(statusIcon) : task.status === 'failed' ? chalk.red(statusIcon) : chalk.yellow(statusIcon)}`);
      console.log(`  ${chalk.dim("Created:")} ${new Date(task.createdAt).toLocaleString()}`);
      
      if (task.completedAt) {
        console.log(`  ${chalk.dim("Completed:")} ${new Date(task.completedAt).toLocaleString()}`);
      }
      
      if (task.inputData && Object.keys(task.inputData).length > 0) {
        console.log();
        console.log(chalk.dim("  ─ Input Data ─"));
        for (const [key, value] of Object.entries(task.inputData)) {
          console.log(`  ${chalk.cyan(key)}: ${chalk.white(String(value))}`);
        }
      }
      
      if (task.status === 'completed' && task.resultData) {
        console.log();
        console.log(chalk.green("  ─ Result ─"));
        for (const [key, value] of Object.entries(task.resultData)) {
          if (typeof value === 'string' && value.startsWith('http')) {
            console.log(`  ${chalk.cyan(key)}: ${chalk.underline.blue(value)}`);
          } else {
            console.log(`  ${chalk.cyan(key)}: ${chalk.white(String(value))}`);
          }
        }
      }
      
      if (task.status === 'failed' && task.resultData?.error) {
        console.log();
        console.log(chalk.red(`  Error: ${task.resultData.error}`));
      }
      
      if (task.lastDispatchError) {
        console.log();
        console.log(chalk.dim(`  Dispatch attempts: ${task.dispatchAttempts}`));
        console.log(chalk.dim(`  Last error: ${task.lastDispatchError}`));
      }
      
      console.log();
    } catch (error) {
      showError(error.message || "Failed to fetch task");
    }
  });

// -----------------
// Jobs Commands (Developer Job Board)
// -----------------
program
  .command("jobs [query...]")
  .description("Browse developer job vacancies")
  .option("-t, --type <type>", "Work type: remote, contract, freelance")
  .option("-l, --level <level>", "Experience: junior, middle, senior, lead")
  .option("-s, --skills <skills>", "Required skills (comma-separated)")
  .option("--location <location>", "Location filter")
  .option("--limit <n>", "Limit results", "20")
  .action(async (query, opts) => {
    try {
      const spinner = createSpinner("Fetching vacancies...");
      
      const params = new URLSearchParams();
      if (query?.length) params.set("q", query.join(" "));
      if (opts.type) params.set("workType", opts.type);
      if (opts.level) params.set("experienceLevel", opts.level);
      if (opts.skills) params.set("skills", opts.skills);
      if (opts.location) params.set("location", opts.location);
      if (opts.limit) params.set("limit", opts.limit);
      
      const url = `/vacancies${params.toString() ? "?" + params.toString() : ""}`;
      const vacancies = await apiGet(url);
      stopSpinner(spinner);
      
      if (!vacancies?.length) {
        showInfoBox("No vacancies found", "Try different filters or check back later\n💡 tm jobs --type=remote");
        return;
      }
      
      showSection(`💼 Developer Jobs (${vacancies.length})`);
      console.log();
      
      vacancies.forEach((v, i) => {
        const workIcon = { remote: '🌍', contract: '📝', freelance: '💼', hybrid: '🏢' }[v.workType] || '📍';
        const salary = (v.salaryMin || v.salaryMax) 
          ? chalk.green(` $${v.salaryMin || '?'}k-${v.salaryMax || '?'}k`) 
          : '';
        const skills = v.requiredSkills?.slice(0, 3).join(', ') || '';
        
        console.log(`  ${chalk.dim(`${i + 1}.`)} ${chalk.white.bold(v.title)}`);
        console.log(`     ${workIcon} ${v.workType}${salary}${skills ? chalk.dim(` | ${skills}`) : ''}`);
        console.log(`     ${chalk.dim('@ ' + (v.seller?.name || 'Unknown'))} • ${chalk.dim(v.applicationCount || 0)} applicants`);
        console.log();
      });
      
      showNextSteps([
        { cmd: "tm job <number>", desc: "view vacancy details" },
        { cmd: "tm apply <number>", desc: "apply for job" }
      ]);
    } catch (error) {
      showError(error.message || "Failed to fetch vacancies");
    }
  });

program
  .command("job <id>")
  .description("View job vacancy details")
  .action(async (id) => {
    try {
      const spinner = createSpinner("Fetching vacancy...");
      const v = await apiGet(`/vacancies/${id}`);
      stopSpinner(spinner);
      
      const workTypes = { remote: '🌍 Remote', contract: '📝 Contract', freelance: '💼 Freelance', hybrid: '🏢 Hybrid', onsite: '📍 On-site' };
      const levels = { junior: '🌱 Junior', middle: '💪 Middle', senior: '⭐ Senior', lead: '👑 Lead', any: 'Any level' };
      
      console.log();
      console.log(chalk.green.bold('  ╔' + '═'.repeat(50) + '╗'));
      console.log(chalk.green.bold('  ║') + chalk.white.bold(`  ${v.title}`.padEnd(50)) + chalk.green.bold('║'));
      console.log(chalk.green.bold('  ╚' + '═'.repeat(50) + '╝'));
      console.log();
      
      console.log(`  ${chalk.dim("Company:")}     ${chalk.white(v.seller?.name || 'Unknown')}`);
      console.log(`  ${chalk.dim("Work Type:")}   ${workTypes[v.workType] || v.workType}`);
      console.log(`  ${chalk.dim("Experience:")}  ${levels[v.experienceLevel] || 'Any'}`);
      console.log(`  ${chalk.dim("Location:")}    ${v.location || 'Anywhere'}`);
      
      if (v.salaryMin || v.salaryMax) {
        const salary = v.salaryMin && v.salaryMax 
          ? `$${v.salaryMin.toLocaleString()} - $${v.salaryMax.toLocaleString()}`
          : v.salaryMin ? `From $${v.salaryMin.toLocaleString()}` : `Up to $${v.salaryMax.toLocaleString()}`;
        console.log(`  ${chalk.dim("Salary:")}      ${chalk.green(salary)}`);
      }
      
      console.log(`  ${chalk.dim("Views:")}       ${v.viewCount || 0}`);
      console.log(`  ${chalk.dim("Applications:")} ${v.applicationCount || 0}`);
      
      if (v.requiredSkills?.length) {
        console.log();
        console.log(`  ${chalk.dim("Skills:")} ${v.requiredSkills.map(s => chalk.cyan(s)).join(', ')}`);
      }
      
      if (v.description) {
        console.log();
        console.log(chalk.dim("  ─ Description ─"));
        console.log(`  ${v.description}`);
      }
      
      console.log();
      console.log(chalk.dim("  ─".repeat(25)));
      console.log(`  ${chalk.green('Apply:')} tm apply ${id}`);
      if (v.applyUrl) {
        console.log(`  ${chalk.dim('External:')} ${chalk.underline.blue(v.applyUrl)}`);
      }
      console.log();
    } catch (error) {
      showError(error.message || "Vacancy not found");
    }
  });

program
  .command("apply <vacancyId>")
  .description("Apply to a job vacancy")
  .option("-c, --cover <text>", "Cover letter")
  .action(async (vacancyId, opts) => {
    try {
      const spinner = createSpinner("Submitting application...");
      
      const payload = {};
      if (opts.cover) payload.coverLetter = opts.cover;
      
      const app = await apiPost(`/vacancies/${vacancyId}/apply`, payload);
      stopSpinner(spinner);
      
      showSuccessBox("Application Submitted!", 
        `Application ID: ${app.applicationId}\nStatus: Pending\n\nThe employer will review your profile and contact you.`);
      
      showNextSteps([
        "tm applications — view your applications",
        "tm profile      — update your profile"
      ]);
    } catch (error) {
      if (error.message?.includes("401")) {
        showError("Login required. Run: tm login <email>");
      } else {
        showError(error.message || "Failed to submit application");
      }
    }
  });

program
  .command("applications")
  .alias("apps")
  .description("View your job applications")
  .action(async () => {
    try {
      const spinner = createSpinner("Fetching applications...");
      const apps = await apiGet("/applications");
      stopSpinner(spinner);
      
      if (!apps?.length) {
        showInfoBox("No applications yet", "Apply to jobs to see your applications here\n💡 tm jobs — browse vacancies");
        return;
      }
      
      showSection(`📋 My Applications (${apps.length})`);
      console.log();
      
      const statusIcons = {
        pending: chalk.yellow('⏳'),
        reviewed: chalk.blue('👀'),
        shortlisted: chalk.green('⭐'),
        rejected: chalk.red('❌'),
        hired: chalk.green('✅')
      };
      
      apps.forEach((a, i) => {
        const date = new Date(a.createdAt).toLocaleDateString();
        const status = statusIcons[a.status] || a.status;
        
        console.log(`  ${chalk.dim(`${i + 1}.`)} ${chalk.white(a.vacancy?.title || 'Unknown Position')}`);
        console.log(`     ${chalk.dim('@ ' + (a.vacancy?.seller?.name || 'Unknown'))} | Applied: ${date}`);
        console.log(`     Status: ${status} ${a.status}`);
        console.log();
      });
    } catch (error) {
      if (error.message?.includes("401")) {
        showError("Login required. Run: tm login <email>");
      } else {
        showError(error.message || "Failed to fetch applications");
      }
    }
  });

// ==================== WATCH — Persistent Pipe Automation ====================
const watchCmd = program
  .command("watch")
  .description("Create and manage persistent watch rules (price alerts, etc.)");

watchCmd
  .command("create")
  .description("Create a watch rule from a pipe query")
  .allowUnknownOption(true)
  .helpOption(false)
  .action(async (opts, cmd) => {
    try {
      // Parse raw args: everything after "create" is the pipe query + watch flags
      const rawArgs = cmd.args || [];
      const WATCH_FLAGS = new Set(["--notify", "--interval", "--action", "--name"]);
      const queryParts = [];
      let notifyVia = "in_app", intervalMinutes = 60, action = "notify", name = null;
      
      for (let i = 0; i < rawArgs.length; i++) {
        if (WATCH_FLAGS.has(rawArgs[i]) && rawArgs[i + 1]) {
          const flag = rawArgs[i];
          const val = rawArgs[++i];
          if (flag === "--notify") notifyVia = val;
          else if (flag === "--interval") intervalMinutes = parseInt(val, 10) || 60;
          else if (flag === "--action") action = val;
          else if (flag === "--name") name = val;
        } else {
          queryParts.push(rawArgs[i]);
        }
      }
      
      const pipeQuery = queryParts.join(" ");
      if (!pipeQuery) {
        showError("Please provide a pipe query. Example: tm watch create search coffee --sort price --notify telegram");
        process.exitCode = 1;
        return;
      }
      
      const spinner = createSpinner("Creating watch rule...");
      const result = await apiPost("/watch-rules", {
        pipeQuery,
        name,
        notifyVia,
        action,
        intervalMinutes,
      });
      stopSpinner(spinner);
      
      showSuccess(`Watch rule #${result.id} created`);
      console.log(`  ${chalk.dim("Query:")}   ${chalk.yellow(result.pipeQuery)}`);
      console.log(`  ${chalk.dim("Every:")}   ${result.intervalMinutes} min`);
      console.log(`  ${chalk.dim("Notify:")}  ${result.notifyVia}`);
      console.log(`  ${chalk.dim("Action:")}  ${result.action}`);
      if (result.name) console.log(`  ${chalk.dim("Name:")}    ${result.name}`);
      console.log();
      console.log(chalk.dim(`  Manage: tm watch list | tm watch pause ${result.id} | tm watch delete ${result.id}`));
    } catch (e) {
      showError(e?.message || "Failed to create watch rule");
      process.exitCode = 1;
    }
  });

watchCmd
  .command("list")
  .description("List your watch rules")
  .action(async () => {
    try {
      const spinner = createSpinner("Fetching watch rules...");
      const rules = await apiGet("/watch-rules");
      stopSpinner(spinner);
      
      if (!Array.isArray(rules) || rules.length === 0) {
        showInfoBox("No watch rules", "Create one: tm watch create search coffee --notify telegram");
        return;
      }
      
      showSection(`Watch Rules (${rules.length})`);
      console.log();
      
      for (const r of rules) {
        const status = r.status === "active" ? chalk.green("●") : chalk.dim("○");
        const nameStr = r.name ? chalk.white(r.name) + " — " : "";
        console.log(`  ${status} ${chalk.yellow(`#${r.id}`)} ${nameStr}${chalk.dim(r.pipeQuery)}`);
        console.log(`    ${chalk.dim(`every ${r.intervalMinutes}m · ${r.notifyVia} · ${r.totalChecks || 0} checks · ${r.totalMatches || 0} matches`)}`);
      }
      console.log();
    } catch (e) {
      if (e.message?.includes("401")) {
        showError("Login required. Run: tm login <email>");
      } else {
        showError(e?.message || "Failed to load watch rules");
      }
    }
  });

watchCmd
  .command("pause <id>")
  .description("Pause a watch rule")
  .action(async (id) => {
    try {
      await apiPatch(`/watch-rules/${id}`, { status: "paused" });
      showSuccess(`Watch rule #${id} paused`);
    } catch (e) {
      showError(e?.message || "Failed to pause rule");
      process.exitCode = 1;
    }
  });

watchCmd
  .command("resume <id>")
  .description("Resume a paused watch rule")
  .action(async (id) => {
    try {
      await apiPatch(`/watch-rules/${id}`, { status: "active" });
      showSuccess(`Watch rule #${id} resumed`);
    } catch (e) {
      showError(e?.message || "Failed to resume rule");
      process.exitCode = 1;
    }
  });

watchCmd
  .command("delete <id>")
  .alias("rm")
  .description("Delete a watch rule")
  .action(async (id) => {
    try {
      await apiDelete(`/watch-rules/${id}`);
      showSuccess(`Watch rule #${id} deleted`);
    } catch (e) {
      showError(e?.message || "Failed to delete rule");
      process.exitCode = 1;
    }
  });

watchCmd
  .command("logs <id>")
  .alias("history")
  .description("View execution history for a watch rule")
  .action(async (id) => {
    try {
      const spinner = createSpinner("Fetching logs...");
      const logs = await apiGet(`/watch-rules/${id}/logs`);
      stopSpinner(spinner);
      
      if (!Array.isArray(logs) || logs.length === 0) {
        showInfoBox("No logs yet", `Rule #${id} hasn't been checked yet.`);
        return;
      }
      
      showSection(`Logs for watch rule #${id}`);
      console.log();
      
      for (const log of logs.slice(0, 20)) {
        const icon = log.isNew ? chalk.yellow("!") : chalk.dim("·");
        const date = new Date(log.createdAt).toLocaleString();
        const count = `${log.resultCount} result(s)`;
        const action = log.actionTaken ? ` · ${log.actionTaken}` : "";
        const ms = log.executionMs ? ` · ${log.executionMs}ms` : "";
        console.log(`  ${icon} ${chalk.dim(date)} — ${count}${action}${ms}`);
      }
      console.log();
    } catch (e) {
      showError(e?.message || "Failed to load logs");
      process.exitCode = 1;
    }
  });

// Shortcut: `tm watch` with no subcommand shows help
watchCmd.action(() => {
  watchCmd.outputHelp();
});

// ==================== TELEGRAM — Connect for Notifications ====================
const telegramCmd = program
  .command("telegram")
  .alias("tg")
  .description("Link/unlink Telegram for notifications");

telegramCmd
  .command("link <code>")
  .description("Link your Telegram using code from @TerminalMarketBot")
  .action(async (code) => {
    try {
      const spinner = createSpinner("Linking Telegram...");
      await apiPost("/user/telegram/link", { code: code.toUpperCase() });
      stopSpinner(spinner);
      showSuccess("Telegram linked! You'll receive watch alerts and notifications there.");
    } catch (e) {
      showError(e?.message || "Failed to link Telegram");
      process.exitCode = 1;
    }
  });

telegramCmd
  .command("unlink")
  .alias("disconnect")
  .description("Disconnect Telegram from your account")
  .action(async () => {
    try {
      await apiPost("/user/telegram/unlink");
      showSuccess("Telegram disconnected.");
    } catch (e) {
      showError(e?.message || "Failed to unlink Telegram");
      process.exitCode = 1;
    }
  });

telegramCmd
  .command("status")
  .description("Check if Telegram is linked")
  .action(async () => {
    try {
      const data = await apiGet("/user/telegram/status");
      if (data.linked) {
        showSuccess("Telegram is connected. You'll receive notifications there.");
        console.log(chalk.dim("  To disconnect: tm telegram unlink"));
      } else {
        console.log(chalk.dim("  Telegram is not connected."));
        console.log(chalk.dim("  1. Open @TerminalMarketBot in Telegram"));
        console.log(chalk.dim("  2. Send /start to get your code"));
        console.log(chalk.dim("  3. Run: tm telegram link <CODE>"));
      }
    } catch (e) {
      if (e.message?.includes("401")) {
        showError("Login required. Run: tm login <email>");
      } else {
        showError(e?.message || "Failed to check status");
      }
    }
  });

telegramCmd.action(() => {
  telegramCmd.outputHelp();
});

// ==================== REQUEST — Reverse Marketplace ====================
const requestCmd = program
  .command("request")
  .alias("req")
  .description("Reverse Marketplace: post what you need, sellers compete");

requestCmd
  .command("create <title...>")
  .description("Create a buyer request")
  .option("--category <category>", "Category slug")
  .option("--budget <amount>", "Maximum budget")
  .option("--deadline <time>", "Deadline (30m, 2h, 3d)", "2h")
  .action(async (titleParts, opts) => {
    try {
      const title = titleParts.join(" ");
      const body = { title };
      if (opts.category) body.category = opts.category;
      if (opts.budget) body.budgetMax = opts.budget;
      if (opts.deadline) body.deadline = opts.deadline;
      
      const spinner = createSpinner("Creating request...");
      const data = await apiPost("/requests", body);
      stopSpinner(spinner);
      
      showSuccess("Request created!");
      console.log(`  ${chalk.dim("ID:")}       #${data.id}`);
      console.log(`  ${chalk.dim("Title:")}    ${data.title}`);
      if (data.budgetMax) console.log(`  ${chalk.dim("Budget:")}   up to ${data.currency || 'USD'} ${data.budgetMax}`);
      if (data.category) console.log(`  ${chalk.dim("Category:")} ${data.category}`);
      if (data.expiresAt) {
        const exp = new Date(data.expiresAt);
        const diff = exp.getTime() - Date.now();
        const hours = Math.floor(diff / 3600000);
        const mins = Math.floor((diff % 3600000) / 60000);
        console.log(`  ${chalk.dim("Expires:")}  ${hours > 0 ? hours + 'h ' : ''}${mins}m`);
      }
      console.log();
      console.log(chalk.dim("  Matching sellers have been notified. View offers:"));
      console.log(chalk.cyan(`  tm request view ${data.id}`));
    } catch (e) {
      showError(e?.message || "Failed to create request");
      process.exitCode = 1;
    }
  });

requestCmd
  .command("list")
  .description("List your buyer requests")
  .action(async () => {
    try {
      const spinner = createSpinner("Fetching requests...");
      const data = await apiGet("/requests/my");
      stopSpinner(spinner);
      
      const requests = data.requests || [];
      if (requests.length === 0) {
        showInfoBox("No requests", "Create one: tm request create \"Need a laptop\" --budget 700 --category electronics");
        return;
      }
      
      showSection(`Your Requests (${requests.length})`);
      console.log();
      
      const statusIcons = { active: chalk.green("●"), fulfilled: chalk.green("✓"), expired: chalk.dim("○"), cancelled: chalk.red("✗") };
      
      for (const r of requests) {
        const icon = statusIcons[r.status] || chalk.dim("?");
        const budget = r.budgetMax ? ` · up to ${r.currency || 'USD'} ${r.budgetMax}` : "";
        const proposals = r.proposalCount > 0 ? chalk.green(` · ${r.proposalCount} offer(s)`) : "";
        console.log(`  ${icon} ${chalk.yellow(`#${r.id}`)} ${r.title}${budget}${proposals} · ${r.status}`);
      }
      console.log();
      console.log(chalk.dim("  View proposals: tm request view <id>"));
    } catch (e) {
      if (e.message?.includes("401")) {
        showError("Login required. Run: tm login <email>");
      } else {
        showError(e?.message || "Failed to fetch requests");
      }
    }
  });

requestCmd
  .command("view <id>")
  .description("View a request and its proposals")
  .action(async (id) => {
    try {
      const spinner = createSpinner("Fetching request...");
      const data = await apiGet(`/requests/${id}`);
      stopSpinner(spinner);
      
      const { request, proposals } = data;
      
      showSection(`Request #${request.id}: ${request.title}`);
      console.log(`  ${chalk.dim("Status:")} ${request.status}`);
      if (request.budgetMax) console.log(`  ${chalk.dim("Budget:")} up to ${request.currency || 'USD'} ${request.budgetMax}`);
      
      if (!proposals || proposals.length === 0) {
        console.log();
        console.log(chalk.dim("  No proposals yet. Sellers have been notified."));
        return;
      }
      
      console.log();
      console.log(chalk.yellow.bold(`  Proposals (${proposals.length}):`));
      console.log();
      
      for (const [i, p] of proposals.entries()) {
        const statusTag = p.status === "accepted" ? chalk.green(" [ACCEPTED]") : 
                          p.status === "rejected" ? chalk.dim(" [rejected]") :
                          p.status === "withdrawn" ? chalk.dim(" [withdrawn]") : "";
        console.log(`  ${chalk.dim(`${i + 1}.`)} ${chalk.white(p.sellerName || 'Seller')}: ${p.title} — ${chalk.green(`${p.currency || 'USD'} ${p.price}`)}${statusTag}`);
        if (p.description) console.log(`     ${chalk.dim(p.description)}`);
      }
      
      if (request.status === "active") {
        console.log();
        console.log(chalk.dim("  Accept: tm request accept <requestId> <proposalId>"));
      }
    } catch (e) {
      showError(e?.message || "Failed to load request");
      process.exitCode = 1;
    }
  });

requestCmd
  .command("accept <requestId> <proposalId>")
  .description("Accept a proposal")
  .action(async (requestId, proposalId) => {
    try {
      const spinner = createSpinner("Accepting proposal...");
      await apiPost(`/requests/${requestId}/accept/${proposalId}`);
      stopSpinner(spinner);
      showSuccess(`Proposal #${proposalId} accepted! The seller has been notified.`);
    } catch (e) {
      showError(e?.message || "Failed to accept proposal");
      process.exitCode = 1;
    }
  });

requestCmd
  .command("cancel <id>")
  .description("Cancel a request")
  .action(async (id) => {
    try {
      await apiPost(`/requests/${id}/cancel`);
      showSuccess(`Request #${id} cancelled.`);
    } catch (e) {
      showError(e?.message || "Failed to cancel request");
      process.exitCode = 1;
    }
  });

requestCmd.action(() => {
  requestCmd.outputHelp();
});

program
  .command("help [command]")
  .description("Show help for a command")
  .option("-a, --advanced", "Show advanced commands (cart, AI, rewards)")
  .option("--all", "Show all commands")
  .action((commandName, opts) => {
    if (opts.all) {
      showHelp(null, 'all');
    } else if (opts.advanced) {
      showHelp(null, 'advanced');
    } else {
      showHelp(commandName, 'basic');
    }
  });

// Handle no args - show beautiful welcome screen
if (process.argv.length <= 2) {
  (async () => {
    try {
      const status = await apiGet("/auth/status");
      if (status.isAuthenticated && status.user) {
        const user = status.user;
        const location = { city: user.city };
        showStatusBar(user, location);
      } else {
        showStatusBar(null, getLocation());
      }
    } catch {
      showStatusBar(getUser(), getLocation());
    }
    showWelcome(VERSION);
    process.exit(0);
  })();
} else {
  program.parse(process.argv);
}
