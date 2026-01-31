#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import open from "open";
import readline from "readline";

import { apiGet, apiPost, apiDelete, apiPatch } from "../src/api.js";
import { getApiBase, setApiBase, getUser, setUser, clearUser, clearSession } from "../src/config.js";
import { printTable, pickProductFields, pickSellerFields, pickOfferFields, containsQuery, formatStars } from "../src/format.js";

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
  .version("0.6.3");

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
      console.log(chalk.green("Logged out successfully."));
    } catch (e) {
      clearUser();
      clearSession();
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
        await open(authUrl);
        console.log(chalk.dim("Complete login in browser, then run 'tm whoami' to verify."));
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
      await open(authUrl);
      console.log(chalk.dim("Complete login in browser, then run 'tm whoami' to verify."));
    } catch {
      console.log(chalk.yellow("Could not open browser. Visit:"));
      console.log(authUrl);
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
program
  .command("profile")
  .description("View or edit your profile")
  .argument("[field]", "Field to set (name, phone, address, city, country)")
  .argument("[value...]", "Value to set")
  .action(async (field, value) => {
    try {
      const result = await apiGet("/auth/status");
      
      if (!result.isAuthenticated) {
        console.log(chalk.yellow("Not logged in. Use 'tm login' first."));
        return;
      }
      
      if (!field) {
        const user = result.user;
        console.log(chalk.bold("Your Profile"));
        console.log("");
        console.log(`${chalk.dim("name:")} ${user.name || "(not set)"}`);
        console.log(`${chalk.dim("email:")} ${user.email}`);
        console.log(`${chalk.dim("phone:")} ${user.phone || "(not set)"}`);
        console.log(`${chalk.dim("address:")} ${user.address || "(not set)"}`);
        console.log(`${chalk.dim("city:")} ${user.city || "(not set)"}`);
        console.log(`${chalk.dim("country:")} ${user.country || "(not set)"}`);
        console.log("");
        console.log(chalk.dim("To update: tm profile <field> <value>"));
        return;
      }
      
      const validFields = ["name", "phone", "address", "city", "country"];
      if (!validFields.includes(field)) {
        console.error(chalk.red(`Invalid field. Valid fields: ${validFields.join(", ")}`));
        return;
      }
      
      const newValue = value.join(" ");
      if (!newValue) {
        console.error(chalk.red("Value is required."));
        return;
      }
      
      await apiPatch("/profile", { [field]: newValue });
      console.log(chalk.green(`Updated ${field} to "${newValue}"`));
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
      
      if (!cartData.items || cartData.items.length === 0) {
        console.log(chalk.yellow("Your cart is empty."));
        console.log(chalk.dim("Add items with: tm cart add <product-id>"));
        return;
      }
      
      console.log(chalk.bold("Your Cart"));
      console.log("");
      
      let total = 0;
      cartData.items.forEach((item, i) => {
        const subtotal = (item.price || 0) * (item.quantity || 1);
        total += subtotal;
        console.log(`${i + 1}. ${item.name || `Product #${item.productId}`}`);
        console.log(`   ${chalk.dim("qty:")} ${item.quantity}  ${chalk.dim("price:")} $${item.price}  ${chalk.dim("subtotal:")} $${subtotal.toFixed(2)}`);
      });
      
      console.log("");
      console.log(chalk.bold(`Total: $${total.toFixed(2)}`));
      console.log(chalk.dim("Checkout with: tm checkout"));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
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
      await apiPost("/cart/add", { productId: parseInt(productId), quantity });
      console.log(chalk.green(`Added to cart (qty: ${quantity})`));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

cart
  .command("remove <productId>")
  .description("Remove product from cart")
  .action(async (productId) => {
    try {
      await apiPost("/cart/remove", { productId: parseInt(productId) });
      console.log(chalk.green("Removed from cart."));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

cart
  .command("clear")
  .description("Clear all items from cart")
  .action(async () => {
    try {
      await apiPost("/cart/clear", {});
      console.log(chalk.green("Cart cleared."));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
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
      await apiPost("/cart/add", { productId: parseInt(productId), quantity });
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
      
      if (!orders || orders.length === 0) {
        console.log(chalk.yellow("No orders yet."));
        return;
      }
      
      console.log(chalk.bold("Order History"));
      console.log("");
      
      orders.slice(0, limit).forEach((order) => {
        const date = new Date(order.createdAt).toLocaleDateString();
        const statusColor = order.status === "delivered" ? chalk.green :
                           order.status === "shipped" ? chalk.cyan :
                           order.status === "paid" ? chalk.blue :
                           chalk.yellow;
        
        console.log(`${chalk.bold(order.orderNumber || `#${order.id}`)} - ${date}`);
        console.log(`  ${chalk.dim("status:")} ${statusColor(order.status)}  ${chalk.dim("total:")} $${order.total || 0}`);
        console.log("");
      });
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
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
      
      if (data.reviewCount === 0) {
        console.log(chalk.yellow(`No reviews yet for store #${storeId}.`));
        console.log(chalk.dim(`Be the first: tm review ${storeId} <rating> [comment]`));
        return;
      }
      
      console.log(chalk.bold(`Store Reviews`));
      console.log(`${formatStars(Math.round(data.averageRating))} ${data.averageRating.toFixed(1)}/5 (${data.reviewCount} reviews)`);
      console.log("");
      
      data.reviews.forEach((review) => {
        const date = new Date(review.createdAt).toLocaleDateString();
        console.log(`${formatStars(review.rating)} by ${review.userName} (${date})`);
        if (review.comment) {
          console.log(`  "${review.comment}"`);
        }
        console.log("");
      });
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
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
        console.error(chalk.red("Store not found."));
        return;
      }
      
      console.log(chalk.bold(store.name));
      if (store.verified) console.log(chalk.green("✓ Verified"));
      console.log("");
      
      if (store.description) console.log(store.description);
      console.log("");
      
      console.log(`${chalk.dim("id:")} ${store.id}`);
      if (store.slug) console.log(`${chalk.dim("slug:")} ${store.slug}`);
      
      try {
        const rating = await apiGet(`/stores/${storeId}/rating`);
        if (rating.count > 0) {
          console.log(`${chalk.dim("rating:")} ${formatStars(Math.round(rating.average))} ${rating.average.toFixed(1)}/5 (${rating.count} reviews)`);
        }
      } catch {}
      
      if (store.website) console.log(`${chalk.dim("website:")} ${store.website}`);
      if (store.supportEmail) console.log(`${chalk.dim("support:")} ${store.supportEmail}`);
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
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
      
      if (!models || models.length === 0) {
        console.log(chalk.yellow("No AI models available yet."));
        return;
      }
      
      console.log(chalk.bold("Available AI Models"));
      console.log("");
      
      const catMap = new Map((categories || []).map(c => [c.id, c]));
      
      // Group by category
      const grouped = {};
      for (const model of models) {
        const cat = catMap.get(model.categoryId);
        const catName = cat ? cat.name : "Other";
        if (!grouped[catName]) grouped[catName] = [];
        grouped[catName].push(model);
      }
      
      for (const [catName, catModels] of Object.entries(grouped)) {
        console.log(chalk.cyan.bold(`${catName}:`));
        for (const model of catModels) {
          const price = parseFloat(model.pricePerRun).toFixed(4);
          console.log(`  ${chalk.white(model.slug.padEnd(25))} $${price}  ${chalk.dim(model.outputType)}`);
          if (model.description) {
            console.log(`    ${chalk.dim(model.description)}`);
          }
        }
        console.log("");
      }
      
      console.log(chalk.dim("Run: tm ai run <model> <input>"));
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
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
      
      const result = await apiPost(`/ai/run/${model}`, { input: inputText });
      
      console.log(chalk.bold("AI Result"));
      console.log("");
      
      if (result.output?.message) {
        console.log(result.output.message);
      }
      if (result.output?.note) {
        console.log(chalk.dim(result.output.note));
      }
      
      console.log("");
      console.log(`${chalk.dim("credits used:")} $${result.creditsUsed.toFixed(4)}`);
      console.log(`${chalk.dim("new balance:")} $${result.newBalance}`);
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
  .command("credits")
  .alias("balance")
  .description("Check your AI credit balance")
  .action(async () => {
    try {
      const credits = await apiGet("/credits");
      
      console.log(chalk.bold("AI Credits"));
      console.log("");
      console.log(`${chalk.dim("balance:")}     $${parseFloat(credits.balance).toFixed(4)}`);
      console.log(`${chalk.dim("purchased:")}   $${parseFloat(credits.totalPurchased).toFixed(2)}`);
      console.log(`${chalk.dim("spent:")}       $${parseFloat(credits.totalSpent).toFixed(4)}`);
      console.log("");
      console.log(chalk.dim("Top up: tm ai topup <amount>"));
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
      try {
        await open(result.url);
        console.log(chalk.dim("(Opening in browser...)"));
      } catch {}
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
      try { await open(result.url); } catch {}
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
        productId: parseInt(productId),
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
// where command (location search)
// -----------------
program
  .command("where <city>")
  .description("Find products and sellers in a city")
  .option("-c, --country <country>", "Filter by country")
  .action(async (city, opts) => {
    try {
      console.log(chalk.bold(`Services in ${city}`));
      console.log("");
      
      // Search products by city
      const params = new URLSearchParams();
      params.set("city", city);
      if (opts.country) params.set("country", opts.country);
      
      const products = await apiGet(`/products?${params.toString()}`);
      const localProducts = (products || []).filter(p => 
        p.serviceType === "local" && 
        p.serviceCity?.toLowerCase() === city.toLowerCase()
      );
      
      if (localProducts.length > 0) {
        console.log(chalk.cyan("Products:"));
        localProducts.forEach(p => {
          console.log(`  ${p.name} - $${p.price} (${p.category})`);
        });
        console.log("");
      }
      
      // Search sellers by city
      const sellers = await apiGet("/sellers");
      const localSellers = (sellers || []).filter(s => 
        s.serviceType === "local" && 
        s.baseCity?.toLowerCase() === city.toLowerCase()
      );
      
      if (localSellers.length > 0) {
        console.log(chalk.cyan("Sellers:"));
        localSellers.forEach(s => {
          console.log(`  ${s.name} (${s.slug})`);
        });
      }
      
      if (localProducts.length === 0 && localSellers.length === 0) {
        console.log(chalk.yellow(`No local services found in ${city}.`));
        console.log(chalk.dim("Try: tm products --city <city>"));
      }
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
      
      const products = await apiGet(url);
      const rows = (products || []).slice(0, limit).map(pickProductFields);
      printTable(rows, [
        { key: "id", title: "id" },
        { key: "slug", title: "slug" },
        { key: "name", title: "name" },
        { key: "price", title: "price" },
        { key: "category", title: "category" },
        { key: "serviceType", title: "type" },
      ]);
    } catch (e) {
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
      ]);
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
      process.exitCode = 1;
    }
  });

// Search with server-side filtering
program
  .command("search <query>")
  .description("Search products")
  .option("-l, --limit <n>", "Limit results", "20")
  .option("-c, --category <category>", "Filter by category")
  .option("--city <city>", "Filter by city (for local services)")
  .option("--country <country>", "Filter by country code")
  .option("--price-min <min>", "Minimum price")
  .option("--price-max <max>", "Maximum price")
  .action(async (query, opts) => {
    try {
      const limit = Math.max(1, Math.min(200, Number.parseInt(opts.limit, 10) || 20));
      
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("limit", String(limit));
      if (opts.category) params.set("category", opts.category);
      if (opts.city) params.set("city", opts.city);
      if (opts.country) params.set("country", opts.country);
      if (opts.priceMin) params.set("price_min", opts.priceMin);
      if (opts.priceMax) params.set("price_max", opts.priceMax);
      
      const result = await apiGet(`/products/search?${params.toString()}`);
      const products = result.products || result || [];
      const rows = products.map(pickProductFields);
      
      printTable(rows, [
        { key: "id", title: "id" },
        { key: "slug", title: "slug" },
        { key: "name", title: "name" },
        { key: "price", title: "price" },
        { key: "category", title: "category" },
        { key: "serviceType", title: "type" },
      ]);
      
      if (products.length >= limit) {
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
          try {
            await open(imageUrl);
          } catch {
            console.log(chalk.yellow("Could not open browser. Image URL:"));
            console.log(imageUrl);
          }
        } else {
          console.log(chalk.yellow("No image available for this product."));
        }
        return;
      }
      
      console.log(chalk.bold(p.name || `Product ${productIdOrSlug}`));
      console.log("");
      
      if (p.shortDescription) {
        console.log(chalk.italic(p.shortDescription));
        console.log("");
      }
      
      if (p.description) {
        console.log(p.description);
        console.log("");
      }
      
      console.log(`${chalk.dim("id:")} ${p.productId || p.id}`);
      if (p.slug) console.log(`${chalk.dim("slug:")} ${p.slug}`);
      if (p.category) console.log(`${chalk.dim("category:")} ${p.category}`);
      if (p.price) console.log(`${chalk.dim("price:")} $${p.price}`);
      
      const serviceType = p.serviceType || "global";
      const typeLabel = serviceType === "global" ? "🌍 Global" : 
                       serviceType === "national" ? "🏳️ National" : "📍 Local";
      console.log(`${chalk.dim("serviceType:")} ${typeLabel}`);
      
      if (serviceType === "local" && p.serviceCity) {
        console.log(`${chalk.dim("city:")} ${p.serviceCity}`);
      }
      if ((serviceType === "national" || serviceType === "local") && p.serviceCountry) {
        console.log(`${chalk.dim("country:")} ${p.serviceCountry}`);
      }
      
      // Show image URL if available
      const imageUrl = p.imageUrl || p.image;
      if (imageUrl) {
        console.log("");
        console.log(`${chalk.dim("image:")} ${imageUrl}`);
        console.log(chalk.dim(`Use: tm view ${p.slug || p.id} --image`));
      }
      
      if (p.buyUrl) console.log(`${chalk.dim("buyUrl:")} ${p.buyUrl}`);
      if (p.subscriptionAvailable) console.log(`${chalk.dim("subscription:")} ${chalk.green("available")}`);
      if (p.tags && p.tags.length > 0) console.log(`${chalk.dim("tags:")} ${p.tags.join(", ")}`);
      if (p.storeId) console.log(`${chalk.dim("storeId:")} ${p.storeId}`);
      
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
        url = p.buyUrl || `${getApiBase().replace('/api', '')}/product/${p.slug || p.id}`;
      }
      
      console.log(chalk.green("Opening:"), url);
      try {
        await open(url);
      } catch {
        console.log(chalk.yellow("Could not open browser. URL:"));
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

      let buyUrl = p.buyUrl;
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
        console.error(chalk.red("This product has no buyUrl."));
        process.exitCode = 1;
        return;
      }

      console.log(chalk.green("Opening:"), buyUrl);
      if (intentId) {
        console.log(chalk.dim(`Intent ID: ${intentId}`));
      }
      
      if (opts.open !== false) {
        await open(buyUrl);
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
      
      const rows = (sellers || []).slice(0, limit).map(pickSellerFields);
      printTable(rows, [
        { key: "slug", title: "slug" },
        { key: "name", title: "name" },
        { key: "serviceType", title: "type" },
        { key: "verified", title: "verified" },
      ]);
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
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
        console.error(chalk.red("Seller not found"));
        process.exitCode = 1;
        return;
      }
      
      console.log(chalk.bold(seller.name));
      if (seller.verified) {
        console.log(chalk.green("✓ Verified Seller"));
      }
      console.log("");
      
      if (seller.description) console.log(seller.description);
      console.log("");
      
      console.log(`${chalk.dim("slug:")} ${seller.slug}`);
      
      const serviceType = seller.serviceType || "global";
      const typeLabel = serviceType === "global" ? "🌍 Global (SaaS/Digital)" : 
                       serviceType === "national" ? "🏳️ National" : "📍 Local";
      console.log(`${chalk.dim("serviceType:")} ${typeLabel}`);
      
      if (serviceType === "local" && seller.baseCity) {
        console.log(`${chalk.dim("city:")} ${seller.baseCity}`);
      }
      if ((serviceType === "national" || serviceType === "local") && seller.baseCountry) {
        console.log(`${chalk.dim("country:")} ${seller.baseCountry}`);
      }
      
      if (seller.website) console.log(`${chalk.dim("website:")} ${seller.website}`);
      if (seller.supportEmail) console.log(`${chalk.dim("support:")} ${seller.supportEmail}`);
      if (seller.badges && seller.badges.length > 0) {
        console.log(`${chalk.dim("badges:")} ${seller.badges.join(", ")}`);
      }
      if (seller.categories && seller.categories.length > 0) {
        console.log(`${chalk.dim("categories:")} ${seller.categories.join(", ")}`);
      }
      if (seller.shippingPolicy) console.log(`${chalk.dim("shippingPolicy:")} ${seller.shippingPolicy}`);
      if (seller.returnPolicy) console.log(`${chalk.dim("returnPolicy:")} ${seller.returnPolicy}`);
      
    } catch (e) {
      console.error(chalk.red(e?.message || String(e)));
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
    console.log(chalk.bold("TerminalMarket"));
    console.log("The marketplace for developers who prefer the command line.\n");
    console.log("We connect developers with premium services: coffee subscriptions,");
    console.log("healthy snacks, coworking spaces, productivity tools, and more.\n");
    console.log(chalk.dim("Website: https://terminalmarket.app"));
    console.log(chalk.dim("CLI:     npm i -g terminalmarket"));
  });

// -----------------
// help
// -----------------
program
  .command("help")
  .description("Show help")
  .action(() => {
    program.outputHelp();
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
