# StockMaster

**StockMaster** is a full-stack inventory and sales management application built with ASP.NET Core Web API, SQL Server, Entity Framework Core, and React. It provides a workspace for tracking products, suppliers, categories, sales, and stock movements.

## Features

- **Dashboard:** product count, sales count, inventory value (based on selling prices), and low-stock alerts.
- **Products:** create, browse, edit, and manage products, including SKU, prices, quantities, categories, suppliers, and locally hosted images. Browse products in grid or table views.
- **Categories and suppliers:** manage reference data for inventory.
- **Sales:** record sales and deduct sold quantities from stock, with transaction-based updates.
- **Stock movements:** record incoming and outgoing inventory adjustments.
- **Authentication:** JWT-based sign-in and sign-out.
- **Role-based authorization:** Admin and Employee roles; administrator-only operations are enforced in the API.
- **User management:** administrators can manage employee accounts and activation status.

## Technology stack

| Layer | Technology |
| --- | --- |
| Backend | ASP.NET Core 8 Web API, C# |
| Database | Microsoft SQL Server |
| Data access | Entity Framework Core |
| Frontend | React, Vite, JavaScript, CSS |
| Authentication | JWT Bearer authentication; ASP.NET Core password hashing |
| API exploration | Swagger (development environment) |
| Tests | xUnit-based API tests |

## Project structure

```text
StockMaster.API/
├── Controllers/                 # API endpoints
├── Data/                        # Entity Framework DbContext
├── DTOs/                        # API request models
├── Models/                      # Entity models
├── stockmaster.client/          # React/Vite frontend
│   ├── public/products/         # Local product image assets
│   └── src/                     # Frontend source
├── StockMaster.API.Tests/       # Automated tests (if present in solution)
└── README.md                    # This file
```

## Local development

### Prerequisites

- .NET 8 SDK
- Node.js and npm compatible with the installed Vite version
- Microsoft SQL Server
- Visual Studio 2022 or another .NET-capable IDE

### 1. Configure the database

Create or restore a **development database** with the schema expected by the Entity Framework models. Configure the `DefaultConnection` connection string for your local SQL Server instance using ASP.NET Core User Secrets or environment variables.

> This repository does not include a complete database initialization script. The database schema must be provided separately before the API can run successfully.

The current development configuration contains a safety check requiring the database name `StockMasterDB_Test`. Do not point the development configuration at a production or original database without reviewing that safeguard and your deployment configuration.

### 2. Configure JWT

Set the following values through **User Secrets** or environment variables, not in source control:

- `Jwt:Key` — a strong signing key of at least 32 UTF-8 bytes
- `Jwt:Issuer`
- `Jwt:Audience`

For example, from the API project directory:

```bash
dotnet user-secrets set "Jwt:Key" "REPLACE_WITH_YOUR_OWN_LONG_RANDOM_SECRET"
dotnet user-secrets set "Jwt:Issuer" "StockMaster"
dotnet user-secrets set "Jwt:Audience" "StockMasterClient"
```

These are **illustrative values**. Use settings consistent with your environment and keep real secrets private.

### 3. Start the backend

Open the solution in Visual Studio 2022, select the API HTTPS launch profile, and run the project. Swagger is available in the development environment, typically at:

```text
https://localhost:7106/swagger
```

The port depends on your local launch settings.

### 4. Start the frontend

From `stockmaster.client`:

```bash
npm install
npm run dev
```

Open the local address printed by Vite (commonly `http://localhost:5173`). The frontend requires the API to be running and reachable.

### 5. Build the frontend

```bash
npm run build
```

## Access and permissions

- **Admin:** access to inventory operations and administrative functions such as user management and restricted deletion operations.
- **Employee:** access to authorized day-to-day inventory and sales operations.

The API enforces authorization independently of which controls are visible in the frontend. Accounts and credentials should be provisioned securely for each environment; no default passwords are published here.

## Product images

Product image files are served from `stockmaster.client/public/products/`. The product's `ImageUrl` field stores a local URL such as:

```text
/products/laptop-dell-inspiron-15.jpg
```

Product illustrations are demonstration assets and may not exactly match real commercial models.

## Security and deployment notes

- Never commit `secrets.json`, passwords, JWT signing keys, or real connection strings.
- Do not commit `node_modules`, build outputs, or development database backups.
- Configure HTTPS, environment-specific settings, database access, and CORS appropriately before deploying.
- Successful local builds do not by themselves establish production readiness; review authorization, session handling, error responses, backups, and hosting configuration before going live.

## Current status

The core application is implemented and runs locally with demonstration inventory data. Production deployment and a reproducible database setup are not yet documented as complete.
