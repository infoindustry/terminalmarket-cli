import chalk from "chalk";

// Box drawing characters
const BOX = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  leftT: '├',
  rightT: '┤',
  topT: '┬',
  bottomT: '┴',
  cross: '┼',
};

// Print a beautiful box header
export function printHeader(title, subtitle = null) {
  const width = 50;
  const line = BOX.horizontal.repeat(width - 2);
  
  console.log();
  console.log(chalk.green(`${BOX.topLeft}${line}${BOX.topRight}`));
  
  const titlePadded = title.padStart(Math.floor((width - 2 + title.length) / 2)).padEnd(width - 2);
  console.log(chalk.green(BOX.vertical) + chalk.white.bold(titlePadded) + chalk.green(BOX.vertical));
  
  if (subtitle) {
    const subPadded = subtitle.padStart(Math.floor((width - 2 + subtitle.length) / 2)).padEnd(width - 2);
    console.log(chalk.green(BOX.vertical) + chalk.dim(subPadded) + chalk.green(BOX.vertical));
  }
  
  console.log(chalk.green(`${BOX.bottomLeft}${line}${BOX.bottomRight}`));
  console.log();
}

// Print a divider line
export function printDivider(char = '─', color = chalk.dim) {
  console.log(color(char.repeat(50)));
}

// Print success message
export function printSuccess(message) {
  console.log(chalk.green('✓ ') + chalk.white(message));
}

// Print error message
export function printError(message) {
  console.log(chalk.red('✗ ') + chalk.white(message));
}

// Print warning message
export function printWarning(message) {
  console.log(chalk.yellow('⚠ ') + chalk.white(message));
}

// Print info message
export function printInfo(message) {
  console.log(chalk.cyan('ℹ ') + chalk.white(message));
}

// Print a key-value pair
export function printField(label, value, labelColor = chalk.dim) {
  console.log(`  ${labelColor(label + ':')} ${chalk.white(value)}`);
}

// Print empty state
export function printEmpty(message, hint = null) {
  console.log();
  console.log(chalk.dim('  ' + message));
  if (hint) {
    console.log(chalk.dim('  💡 ' + hint));
  }
  console.log();
}

// Beautiful table with borders
export function printTable(rows, columns, options = {}) {
  const { title, showIndex = false, compact = false } = options;
  
  if (!rows?.length) {
    printEmpty("No results found.", "Try a different search or filter.");
    return;
  }
  
  // Calculate column widths
  const widths = {};
  for (const col of columns) {
    widths[col.key] = Math.max(
      col.title.length, 
      ...rows.map(r => String(r[col.key] ?? "").length)
    );
  }
  
  if (showIndex) {
    widths._index = Math.max(1, String(rows.length).length);
  }
  
  // Build header
  const headerParts = [];
  if (showIndex) {
    headerParts.push(chalk.dim('#'.padEnd(widths._index)));
  }
  for (const col of columns) {
    headerParts.push(chalk.cyan.bold(col.title.padEnd(widths[col.key])));
  }
  
  // Print title if provided
  if (title) {
    console.log();
    console.log(chalk.green.bold(`  ${title}`));
    console.log();
  }
  
  // Print header
  console.log('  ' + headerParts.join('  '));
  
  // Print separator
  const sepParts = [];
  if (showIndex) {
    sepParts.push(chalk.dim('─'.repeat(widths._index)));
  }
  for (const col of columns) {
    sepParts.push(chalk.dim('─'.repeat(widths[col.key])));
  }
  console.log('  ' + sepParts.join('──'));
  
  // Print rows
  rows.forEach((r, index) => {
    const rowParts = [];
    if (showIndex) {
      rowParts.push(chalk.dim(String(index + 1).padEnd(widths._index)));
    }
    
    for (const col of columns) {
      let value = String(r[col.key] ?? "").padEnd(widths[col.key]);
      
      // Apply color based on column type
      if (col.key === 'price' || col.key === 'total') {
        value = chalk.green(value);
      } else if (col.key === 'status') {
        const status = r[col.key]?.toLowerCase() || '';
        if (status === 'delivered' || status === 'active' || status === 'paid') {
          value = chalk.green(value);
        } else if (status === 'shipped' || status === 'processing') {
          value = chalk.cyan(value);
        } else if (status === 'pending') {
          value = chalk.yellow(value);
        } else if (status === 'cancelled' || status === 'suspended') {
          value = chalk.red(value);
        } else {
          value = chalk.white(value);
        }
      } else if (col.key === 'verified') {
        value = r[col.key] === '✓' ? chalk.green(value) : chalk.dim(value);
      } else if (col.key === 'name' || col.key === 'title') {
        value = chalk.white.bold(value);
      } else if (col.key === 'id' || col.key === 'slug') {
        value = chalk.dim(value);
      } else if (col.key === 'category') {
        value = chalk.magenta(value);
      } else {
        value = chalk.white(value);
      }
      
      rowParts.push(value);
    }
    
    console.log('  ' + rowParts.join('  '));
  });
  
  // Print footer with count
  console.log();
  console.log(chalk.dim(`  Showing ${rows.length} result${rows.length !== 1 ? 's' : ''}`));
}

// Print product card
export function printProductCard(p) {
  const width = 50;
  const line = '─'.repeat(width);
  
  console.log();
  console.log(chalk.cyan(line));
  console.log();
  
  // Name
  console.log(chalk.white.bold('  ' + (p.name || 'Unknown Product')));
  
  // Short description
  if (p.shortDescription) {
    console.log(chalk.dim('  ' + p.shortDescription));
  }
  console.log();
  
  // Price (big and prominent)
  if (p.price) {
    console.log(chalk.green.bold(`  $${p.price}`));
    console.log();
  }
  
  // Details
  if (p.description) {
    console.log(chalk.white('  ' + p.description));
    console.log();
  }
  
  // Meta info
  console.log(chalk.dim('  ─────────────────────────────'));
  
  printField('ID', p.productId || p.id || '-');
  if (p.slug) printField('Slug', p.slug);
  if (p.category) printField('Category', p.category);
  
  const serviceType = p.serviceType || 'global';
  const typeLabel = serviceType === 'global' ? '🌍 Global' : 
                   serviceType === 'national' ? '🏳️ National' : '📍 Local';
  printField('Type', typeLabel);
  
  if (serviceType === 'local' && p.serviceCity) {
    printField('City', p.serviceCity);
  }
  if ((serviceType === 'local' || serviceType === 'national') && p.serviceCountry) {
    printField('Country', p.serviceCountry);
  }
  
  if (p.storeId || p.sellerId) {
    printField('Store', p.storeId || p.sellerId);
  }
  
  console.log();
  console.log(chalk.cyan(line));
  
  // Actions hint
  console.log();
  console.log(chalk.dim('  💡 Quick actions:'));
  console.log(chalk.dim('     tm add ' + (p.productId || p.id)) + chalk.dim(' — add to cart'));
  console.log(chalk.dim('     tm buy ' + (p.slug || p.productId || p.id)) + chalk.dim(' — buy directly'));
  console.log();
}

// Print cart with totals
export function printCart(items, total) {
  if (!items?.length) {
    printEmpty("Your cart is empty.", "Add items with: tm add <product-id>");
    return;
  }
  
  console.log();
  console.log(chalk.green.bold('  🛒 Your Cart'));
  console.log();
  
  items.forEach((item, i) => {
    const subtotal = (item.price || 0) * (item.quantity || 1);
    
    console.log(chalk.white.bold(`  ${i + 1}. ${item.name || `Product #${item.productId}`}`));
    console.log(`     ${chalk.dim('Qty:')} ${chalk.cyan(item.quantity)}  ${chalk.dim('×')}  ${chalk.green('$' + item.price)}  ${chalk.dim('=')}  ${chalk.green.bold('$' + subtotal.toFixed(2))}`);
    console.log();
  });
  
  console.log(chalk.dim('  ─────────────────────────────────────────'));
  console.log();
  console.log(`  ${chalk.white('Total:')} ${chalk.green.bold('$' + total.toFixed(2))}`);
  console.log();
  console.log(chalk.dim('  💡 tm checkout — proceed to payment'));
  console.log();
}

// Print order history
export function printOrders(orders) {
  if (!orders?.length) {
    printEmpty("No orders yet.", "Start shopping with: tm products");
    return;
  }
  
  console.log();
  console.log(chalk.green.bold('  📦 Order History'));
  console.log();
  
  orders.forEach((order) => {
    const date = new Date(order.createdAt).toLocaleDateString();
    const status = order.status?.toLowerCase() || 'pending';
    
    // Status with color and icon
    let statusDisplay;
    if (status === 'delivered') {
      statusDisplay = chalk.green('✓ Delivered');
    } else if (status === 'shipped') {
      statusDisplay = chalk.cyan('📦 Shipped');
    } else if (status === 'paid') {
      statusDisplay = chalk.blue('💳 Paid');
    } else if (status === 'processing') {
      statusDisplay = chalk.yellow('⏳ Processing');
    } else if (status === 'cancelled') {
      statusDisplay = chalk.red('✗ Cancelled');
    } else {
      statusDisplay = chalk.dim('○ ' + status);
    }
    
    console.log(chalk.white.bold(`  ${order.orderNumber || '#' + order.id}`));
    console.log(`     ${chalk.dim('Date:')} ${date}  ${chalk.dim('Total:')} ${chalk.green('$' + (order.total || 0))}`);
    console.log(`     ${statusDisplay}`);
    if (order.deliveryMethod === 'digital') {
      console.log(`     ${chalk.dim('Download or key in library')}`);
    }
    console.log();
  });
}

// Print store/seller card
export function printStoreCard(s) {
  const width = 50;
  const line = '─'.repeat(width);
  
  console.log();
  console.log(chalk.magenta(line));
  console.log();
  
  // Name with verified badge
  const verified = s.verified ? chalk.green(' ✓') : '';
  console.log(chalk.white.bold('  🏪 ' + (s.name || s.storeName || 'Unknown Store')) + verified);
  
  if (s.description || s.storeDescription) {
    console.log(chalk.dim('  ' + (s.description || s.storeDescription)));
  }
  console.log();
  
  // Rating if available
  if (s.rating || s.averageRating) {
    const rating = s.rating || s.averageRating;
    const stars = formatStars(rating);
    console.log(`  ${chalk.yellow(stars)} ${chalk.dim(`(${rating.toFixed(1)})`)}`);
    console.log();
  }
  
  // Details
  console.log(chalk.dim('  ─────────────────────────────'));
  
  if (s.id) printField('ID', s.id);
  if (s.slug) printField('Slug', s.slug);
  
  const serviceType = s.serviceType || 'global';
  const typeLabel = serviceType === 'global' ? '🌍 Global' : 
                   serviceType === 'national' ? '🏳️ National' : '📍 Local';
  printField('Type', typeLabel);
  
  if (s.baseCity) printField('City', s.baseCity);
  if (s.baseCountry) printField('Country', s.baseCountry);
  
  if (s.categories?.length) {
    printField('Categories', s.categories.join(', '));
  }
  
  console.log();
  console.log(chalk.magenta(line));
  
  // Actions hint
  console.log();
  console.log(chalk.dim('  💡 tm products --store ' + s.id) + chalk.dim(' — view products'));
  console.log(chalk.dim('  💡 tm reviews ' + s.id) + chalk.dim(' — see reviews'));
  console.log();
}

// Print sellers list
export function printSellers(sellers) {
  if (!sellers?.length) {
    printEmpty("No stores found.", "Try adjusting your filters.");
    return;
  }
  
  console.log();
  console.log(chalk.green.bold('  🏪 Stores'));
  console.log();
  
  sellers.forEach((s) => {
    const verified = s.verified ? chalk.green(' ✓') : '';
    const serviceType = s.serviceType || 'global';
    const typeIcon = serviceType === 'global' ? '🌍' : 
                    serviceType === 'national' ? '🏳️' : '📍';
    
    console.log(chalk.white.bold('  ' + (s.name || s.storeName)) + verified);
    console.log(`     ${chalk.dim('Slug:')} ${chalk.cyan(s.slug)}  ${chalk.dim('Type:')} ${typeIcon} ${serviceType}`);
    
    if (s.baseCity || s.baseCountry) {
      const location = [s.baseCity, s.baseCountry].filter(Boolean).join(', ');
      console.log(`     ${chalk.dim('Location:')} ${location}`);
    }
    console.log();
  });
  
  console.log(chalk.dim(`  Showing ${sellers.length} store${sellers.length !== 1 ? 's' : ''}`));
  console.log();
}

// Print reviews
export function printReviews(reviews, averageRating) {
  console.log();
  
  if (averageRating !== undefined) {
    console.log(chalk.green.bold('  ⭐ Store Rating'));
    console.log(`  ${chalk.yellow(formatStars(averageRating))} ${chalk.dim(`(${averageRating.toFixed(1)} average)`)}`);
    console.log();
  }
  
  if (!reviews?.length) {
    printEmpty("No reviews yet.", "Be the first to review: tm review <store-id> <1-5>");
    return;
  }
  
  console.log(chalk.green.bold('  📝 Reviews'));
  console.log();
  
  reviews.forEach((r) => {
    const stars = formatStars(r.rating);
    const date = new Date(r.createdAt).toLocaleDateString();
    
    console.log(`  ${chalk.yellow(stars)} ${chalk.dim('— ' + date)}`);
    if (r.comment) {
      console.log(chalk.white('  "' + r.comment + '"'));
    }
    console.log();
  });
}

// Print AI models list
export function printAIModels(models, categories = []) {
  if (!models?.length) {
    printEmpty("No AI models available.", "Check back later for new models.");
    return;
  }
  
  console.log();
  console.log(chalk.cyan.bold('  🤖 AI Models'));
  console.log();
  
  // Group by category if categories provided
  const grouped = {};
  models.forEach(m => {
    const cat = m.categoryName || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(m);
  });
  
  for (const [category, catModels] of Object.entries(grouped)) {
    console.log(chalk.magenta.bold(`  ${category}`));
    console.log();
    
    catModels.forEach(m => {
      console.log(chalk.white.bold(`    ${m.name}`));
      console.log(`    ${chalk.dim(m.description || 'No description')}`);
      console.log(`    ${chalk.dim('Provider:')} ${m.provider}  ${chalk.dim('Cost:')} ${chalk.green(m.creditsPerRun + ' credits')}`);
      console.log(`    ${chalk.dim('Run:')} ${chalk.cyan('tm ai run ' + m.slug)}`);
      console.log();
    });
  }
}

// Print credits balance
export function printCredits(balance) {
  console.log();
  console.log(chalk.cyan.bold('  💳 AI Credits'));
  console.log();
  console.log(`  ${chalk.white('Balance:')} ${chalk.green.bold(balance + ' credits')}`);
  console.log();
  console.log(chalk.dim('  💡 tm ai topup <amount> — add more credits'));
  console.log();
}

export function pickProductFields(p) {
  const serviceType = p?.serviceType || "global";
  const typeIcon = serviceType === "global" ? "🌍" : 
                  serviceType === "national" ? "🏳️" : "📍";
  
  return {
    id: p?.productId ?? p?.id ?? "",
    slug: p?.slug ?? "",
    name: p?.name ?? p?.title ?? "",
    category: p?.category ?? "",
    price: p?.price ? `$${p.price}` : (p?.priceDisplay ?? ""),
    buyUrl: p?.buyUrl ?? "",
    serviceType: `${typeIcon} ${serviceType}`,
    serviceCity: p?.serviceCity ?? "",
    serviceCountry: p?.serviceCountry ?? "",
  };
}

export function pickSellerFields(s) {
  const serviceType = s?.serviceType || "global";
  const typeIcon = serviceType === "global" ? "🌍" : 
                  serviceType === "national" ? "🏳️" : "📍";
  
  return {
    id: s?.id ?? "",
    slug: s?.slug ?? "",
    name: s?.name ?? "",
    verified: s?.verified ? "✓" : "",
    badges: Array.isArray(s?.badges) ? s.badges.join(", ") : "",
    status: s?.status ?? "",
    serviceType: `${typeIcon} ${serviceType}`,
    baseCity: s?.baseCity ?? "",
    baseCountry: s?.baseCountry ?? "",
  };
}

export function pickOfferFields(o) {
  const serviceType = o?.serviceType || "global";
  const typeIcon = serviceType === "global" ? "🌍" : 
                  serviceType === "national" ? "🏳️" : "📍";
  
  return {
    id: o?.id ?? "",
    productId: o?.productId ?? "",
    sellerId: o?.sellerId ?? "",
    price: o?.priceDisplay ?? (o?.price ? `$${o.price}` : ""),
    availability: o?.availability ?? "",
    buyUrl: o?.buyUrl ?? "",
    serviceType: `${typeIcon} ${serviceType}`,
    serviceCity: o?.serviceCity ?? "",
    serviceCountry: o?.serviceCountry ?? "",
  };
}

export function containsQuery(p, q) {
  const hay = [
    p?.name, p?.title, p?.description, p?.shortDescription, p?.category,
    p?.slug, p?.productId, p?.serviceType, p?.serviceCity, p?.serviceCountry,
    ...(Array.isArray(p?.tags) ? p.tags : [])
  ].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q.toLowerCase());
}

export function formatStars(rating) {
  const fullStars = Math.floor(rating);
  const emptyStars = 5 - fullStars;
  return '★'.repeat(fullStars) + '☆'.repeat(emptyStars);
}
