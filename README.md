# TerminalMarket CLI

The command-line interface for [TerminalMarket](https://terminalmarket.app) — a marketplace for developers who prefer the terminal.

## Installation

```bash
npm install -g terminalmarket
```

## Usage

After installation, use the `tm` command:

```bash
tm --help
```

## Commands

### Browse Products

```bash
# List all products
tm products

# List products by category
tm category coffee
tm products --category coffee

# Search products
tm search "morning coffee"

# Filter by location (for local/national services)
tm products --city "San Francisco" --country "US"
tm search "coworking" --city "Berlin"

# View product details
tm view <product-id-or-slug>

# Buy a product (opens in browser)
tm buy <product-id-or-slug>
```

### Service Types

Products have different service types:
- 🌍 **Global** — SaaS, digital products, worldwide delivery
- 🏳️ **National** — Country-wide delivery/services
- 📍 **Local** — City-specific services (food delivery, coworking, etc.)

Local and national products only appear when enough sellers exist in your area.

### Browse Sellers

```bash
# List verified sellers
tm sellers

# Filter sellers by location
tm sellers --city "Austin" --country "US"

# View seller details
tm seller <seller-slug>
```

### View Offers

```bash
# List all offers
tm offers

# Filter by product or seller
tm offers --product 123
tm offers --seller 456
```

### Categories

```bash
# List all categories
tm categories
```

Available categories include:
- `coffee` — Specialty coffee for developers
- `lunch` — Meal subscriptions & delivery
- `snacks` — Healthy snacks & energy packs
- `focus` — Deep work kits & nootropics
- `health` — Yoga, massage, developer health
- `coworking` — Coworking spaces & nomad services
- `digital` — Productivity tools & apps
- `services` — Taxi, booking, personal services

### Information

```bash
# About TerminalMarket
tm about

# View seller subscription tiers
tm tiers
```

### Configuration

```bash
# Get current API endpoint
tm config get api

# Set custom API endpoint (for self-hosted)
tm config set api https://your-instance.com/api
```

## Seller Tiers

| Tier | Price | Products | Commission | Features |
|------|-------|----------|------------|----------|
| Free | $0/mo | 5 | 5% | Basic analytics |
| Basic | $29/mo | 10 | 4% | Priority support |
| Premium | $99/mo | Unlimited | 2.5% | Stripe Connect, Terminal Checkout |

## API Endpoints Used

- `GET /api/products` — List products
- `GET /api/products/:id` — Get product details
- `GET /api/products/slug/:slug` — Get product by slug
- `GET /api/products/category/:category` — Products by category
- `GET /api/products/search` — Search products
- `GET /api/categories` — List categories
- `GET /api/sellers` — List sellers
- `GET /api/sellers/:slug` — Get seller details
- `GET /api/offers` — List offers
- `POST /api/clicks` — Track clicks
- `POST /api/intents` — Create purchase intent

## License

MIT
