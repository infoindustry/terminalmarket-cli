# TerminalMarket CLI

The official command-line interface for [TerminalMarket](https://terminalmarket.app) — a marketplace for developers.

## Installation

```bash
npm install -g terminalmarket
```

## Usage

```bash
tm <command> [options]
```

## Commands

### Authentication

```bash
tm register <email> <password>     # Create a new account
tm login <email> <password>        # Login to your account
tm logout                          # Logout
tm whoami                          # Show current user info
tm me                              # Alias for whoami
```

### Profile

```bash
tm profile                         # View your profile
tm profile name "John Doe"         # Update your name
tm profile phone "+1234567890"     # Update phone
tm profile address "123 Main St"   # Update address
tm profile city "Berlin"           # Update city
tm profile country "DE"            # Update country
```

### Shopping

```bash
tm products                        # List all products
tm products --category coffee      # Filter by category
tm products --store 1              # Filter by store
tm search "coffee berlin"          # Search products
tm view <product-id>               # View product details
tm add <product-id>                # Add to cart
tm cart list                       # View cart
tm cart add <product-id>           # Add to cart
tm cart remove <product-id>        # Remove from cart
tm cart clear                      # Clear cart
tm checkout                        # Proceed to checkout
```

### Orders

```bash
tm orders                          # View order history
tm history                         # Alias for orders
```

### Stores & Reviews

```bash
tm sellers                         # List all sellers/stores
tm stores                          # Alias for sellers
tm seller <slug>                   # View seller details
tm store <store-id>                # View store details
tm reviews <store-id>              # View store reviews
tm review <store-id> <rating> [comment]  # Leave a review (1-5 stars)
```

### Service Types

Products have different service types:
- Global — SaaS, digital products, worldwide delivery
- National — Country-wide delivery/services
- Local — City-specific services (food delivery, coworking, etc.)

### Categories & Offers

```bash
tm categories                      # List all categories
tm category <slug>                 # List products in category
tm offers                          # List all offers
tm offers --product <id>           # Filter by product
tm offers --seller <id>            # Filter by seller
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

### Configuration

```bash
tm config get api                  # Show API endpoint
tm config set api <url>            # Set API endpoint
```

### Other

```bash
tm about                           # About TerminalMarket
tm help                            # Show help
tm --version                       # Show version
```

## Examples

```bash
# Browse coffee products in Berlin
tm search "coffee" --city Berlin

# Add product to cart and checkout
tm add 123
tm checkout

# Leave a 5-star review
tm review 1 5 "Great coffee, fast delivery!"

# View your order history
tm orders
```

## Seller Tiers

| Tier | Price | Products | Commission | Features |
|------|-------|----------|------------|----------|
| Free | $0/mo | 5 | 5% | Basic analytics |
| Basic | $29/mo | 50 | 4% | Priority support |
| Premium | $99/mo | 1000 | 2.5% | Stripe Connect, Terminal Checkout |

## API Endpoints Used

### Public
- `GET /api/products` — List products
- `GET /api/products/:id` — Get product details
- `GET /api/products/slug/:slug` — Get product by slug
- `GET /api/products/category/:category` — Products by category
- `GET /api/products/search` — Search products
- `GET /api/categories` — List categories
- `GET /api/sellers` — List sellers
- `GET /api/sellers/:slug` — Get seller details
- `GET /api/offers` — List offers
- `GET /api/stores/:id/reviews` — Get store reviews
- `GET /api/stores/:id/rating` — Get store rating

### Authenticated
- `POST /api/auth/register` — Create account
- `POST /api/auth/login` — Login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/status` — Check auth status
- `PATCH /api/profile` — Update profile
- `GET /api/cart` — Get cart
- `POST /api/cart/add` — Add to cart
- `POST /api/cart/remove` — Remove from cart
- `POST /api/cart/clear` — Clear cart
- `GET /api/orders` — Get orders
- `POST /api/stores/:id/reviews` — Leave review
- `POST /api/clicks` — Track clicks
- `POST /api/intents` — Create purchase intent

## Configuration

The CLI stores configuration in `~/.config/terminalmarket/config.json`:

- `apiBase`: API endpoint (default: `https://terminalmarket.app/api`)
- `sessionCookie`: Session cookie for authentication
- `user`: Cached user info

## License

MIT
