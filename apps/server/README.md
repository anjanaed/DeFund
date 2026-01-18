# DeFund Backend Server

NestJS backend API for the DeFund milestone-based crowdfunding platform.

## Features

- 🔐 User authentication and authorization
- 📊 Campaign management API
- ⛓️ Blockchain event listening and synchronization
- 💾 PostgreSQL database integration
- 📝 IPFS content caching
- 🔔 Real-time notifications

## Prerequisites

- Node.js >= 16
- PostgreSQL database
- Sepolia RPC endpoint (Alchemy/Infura)

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_DATABASE=defund

# Blockchain
SEPOLIA_RPC_URL=your_rpc_url
CAMPAIGN_FACTORY_ADDRESS=deployed_contract_address
```

## Running the Server

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Endpoints

Base URL: `http://localhost:3000/api`

### Health Check
- `GET /health` - Server health status

### Campaigns (Coming Soon)
- `GET /campaigns` - List all campaigns
- `GET /campaigns/:id` - Get campaign details
- `POST /campaigns` - Create campaign
- `GET /campaigns/:id/milestones` - Get campaign milestones

### Users (Coming Soon)
- `POST /users/register` - Register user
- `POST /users/login` - Login user
- `GET /users/profile` - Get user profile

## Project Structure

```
src/
├── app.module.ts          # Main application module
├── main.ts                # Application entry point
├── campaigns/             # Campaign management (to be created)
├── users/                 # User management (to be created)
├── blockchain/            # Blockchain integration (to be created)
└── common/                # Shared utilities (to be created)
```

## Next Steps

1. Set up PostgreSQL database
2. Deploy smart contracts to Sepolia
3. Update `.env` with contract address
4. Run migrations
5. Start the server

## License

MIT
