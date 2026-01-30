import chalk from "chalk";

export function printTable(rows, columns) {
  if (!rows?.length) {
    console.log(chalk.gray("No results."));
    return;
  }
  const widths = {};
  for (const col of columns) {
    widths[col.key] = Math.max(col.title.length, ...rows.map(r => String(r[col.key] ?? "").length));
  }
  const header = columns.map(c => chalk.bold(String(c.title).padEnd(widths[c.key]))).join("  ");
  console.log(header);
  console.log(columns.map(c => "-".repeat(widths[c.key])).join("  "));
  for (const r of rows) {
    const line = columns.map(c => String(r[c.key] ?? "").padEnd(widths[c.key])).join("  ");
    console.log(line);
  }
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
  
  const tier = s?.subscriptionTier || "free";
  const tierIcon = tier === "premium" ? "★" : tier === "basic" ? "●" : "○";
  
  return {
    id: s?.id ?? "",
    slug: s?.slug ?? "",
    name: s?.name ?? "",
    verified: s?.verified ? "✓" : "",
    badges: Array.isArray(s?.badges) ? s.badges.join(", ") : "",
    status: s?.status ?? "",
    serviceType: `${typeIcon} ${serviceType}`,
    tier: `${tierIcon} ${tier}`,
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
