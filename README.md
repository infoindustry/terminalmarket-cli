# TerminalMarket CLI

The official command-line interface for [TerminalMarket](https://terminalmarket.app) — a marketplace for developers.

## Installation

### npm (requires Node.js)

```bash
npm install -g terminalmarket
```

### Standalone binary (no Node.js needed)

```bash
curl -fsSL https://terminalmarket.app/install.sh | sh
```

This installs `tm` into `~/.local/bin`.

## Usage

```bash
tm <command> [options]
```

## Commands

### Authentication

```bash
tm register <email> [password]     # Create a new account
tm login <email> [password]        # Login to your account
tm logout                          # Logout
tm whoami                          # Show current user info
tm me                              # Alias for whoami
tm auth github                     # Login with GitHub (opens browser)
tm github                          # Shortcut for GitHub auth
```

### Profile

```bash
tm profile                         # View your profile
tm profile view                    # View your profile
tm profile set name "John Doe"     # Update your name
tm profile set phone "+1234567890" # Update phone
tm profile set address "123 Main"  # Update address
tm profile set city "Berlin"       # Update city
tm profile set country "DE"        # Update country
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

### AI Services

Run AI models directly from the terminal using credits.

```bash
tm ai list                         # List available AI models
tm ai run <model> <input>          # Run an AI model
tm ai credits                      # Check your credit balance
tm ai topup <amount>               # Add credits ($5 minimum)
tm ai history                      # View usage history

# Shortcuts
tm credits                         # Check credits (shortcut)
tm topup <amount>                  # Add credits (shortcut)
```

### Aliases & Rewards

```bash
tm alias list                      # List your aliases
tm alias add <name> <command>      # Create alias
tm alias remove <name>             # Remove alias
tm aliases                         # Shortcut for alias list

tm reward list                     # List reward rules
tm reward add <product> <pushes>   # Auto-order after N pushes
tm reward remove <id>              # Remove reward rule
tm rewards                         # Shortcut for reward list
```

### Categories & Offers

```bash
tm categories                      # List all categories
tm category <slug>                 # List products in category
tm offers                          # List all offers
```

Available categories:
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
tm help <command>                  # Help for specific command
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

# Use AI services
tm ai topup 10
tm ai run text-rewrite "Fix this text"
```

## Configuration

The CLI stores configuration in `~/.config/terminalmarket/config.json`:

- `apiBase`: API endpoint (default: `https://terminalmarket.app/api`)
- `sessionCookie`: Session cookie for authentication
- `user`: Cached user info

## Building Binaries

See [INSTALL_BINARIES.md](./INSTALL_BINARIES.md) for instructions on building standalone binaries.

```bash
npm ci
npm run build:bin
```

This produces binaries in `dist/`:
- `tm-linux-x64`
- `tm-macos-x64`
- `tm-macos-arm64`

## License

MIT
