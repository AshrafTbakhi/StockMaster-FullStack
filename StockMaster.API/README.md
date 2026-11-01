# StockMaster — Inventory & Sales Management System

**StockMaster** is a full-stack inventory and sales management application developed using **ASP.NET Core 8 Web API, React, Entity Framework Core, and Microsoft SQL Server**.

The application provides a centralized workspace for managing products, categories, suppliers, sales transactions, stock movements, and employee accounts.

StockMaster was developed as a practical full-stack training and portfolio project, focusing on API development, database integration, authentication, role-based authorization, frontend development, and automated testing.

## Features

### Dashboard
- View total product and sales counts.
- Monitor inventory value calculated using product selling prices.
- Identify products with low stock levels.

### Product Management
- Create, browse, and update product records.
- Manage SKUs, prices, stock quantities, categories, and suppliers.
- Display locally hosted product images.
- Browse inventory using grid and table views.

### Categories and Suppliers
- Manage product categories.
- Maintain supplier information.
- Organize reference data used throughout the inventory system.

### Sales Management
- Record sales transactions.
- Automatically deduct sold quantities from inventory.
- Use database transactions to maintain consistency during sales operations.

### Stock Movements
- Track incoming and outgoing stock adjustments.
- Maintain inventory movement records.

### Authentication and Authorization
- JWT-based authentication.
- Admin and Employee roles.
- Backend enforcement of role-based permissions.
- Account activation checks for authenticated users.

### User Management
- Administrative management of employee accounts.
- Employee account activation and deactivation.
- Restrictions on administrative role changes.

## Technology Stack

| Layer | Technologies |
| --- | --- |
| Frontend | React, Vite, JavaScript, CSS |
| Backend | ASP.NET Core 8 Web API, C# |
| Database | Microsoft SQL Server |
| ORM | Entity Framework Core |
| Authentication | JWT Bearer Authentication |
| Password Security | ASP.NET Core Password Hashing |
| Authorization | Role-Based Access Control |
| API Documentation | Swagger |
| Automated Testing | xUnit |

## Project Structure

```text
StockMaster-FullStack/
├── StockMaster.API/
│   ├── Controllers/
│   ├── Data/
│   ├── DTOs/
│   ├── Models/
│   ├── Program.cs
│   ├── appsettings.json
│   └── README.md
│
├── StockMaster.API.Tests/
│
├── StockMaster.DevTools/
│
├── stockmaster.client/
│   ├── public/
│   │   └── products/
│   ├── src/
│   └── package.json
│
└── StockMaster.API.sln
```

**Directory overview:**

- `StockMaster.API` — ASP.NET Core backend, API controllers, business operations, and data access.
- `StockMaster.API.Tests` — automated API tests.
- `StockMaster.DevTools` — supporting development utilities.
- `stockmaster.client` — React frontend application and static assets.
- `StockMaster.API.sln` — Visual Studio solution file.

## Getting Started

### Prerequisites

Install the following:

- .NET 8 SDK
- Node.js and npm compatible with the project's Vite version
- Microsoft SQL Server
- Visual Studio 2022 or another compatible .NET development environment

### 1. Database Configuration

Create or restore a development database containing the schema expected by the Entity Framework models.

Configure the `DefaultConnection` connection string for your local SQL Server instance using **ASP.NET Core User Secrets** or environment variables.

**Important:** The repository does not currently include a complete database initialization script. The database schema must be prepared separately before the API can run successfully.

The current development configuration includes a database safety check requiring the database name:

```text
StockMasterDB_Test
```

Do not connect the development environment to the original or a production database without reviewing the database safeguard and deployment configuration.

### 2. JWT Configuration

Configure the following settings securely:

| Setting | Description |
| --- | --- |
| `Jwt:Key` | JWT signing key, at least 32 UTF-8 bytes |
| `Jwt:Issuer` | Token issuer |
| `Jwt:Audience` | Intended token audience |

From the API project directory, example commands are:

```bash
dotnet user-secrets set "Jwt:Key" "REPLACE_WITH_YOUR_OWN_LONG_RANDOM_SECRET"
dotnet user-secrets set "Jwt:Issuer" "StockMaster"
dotnet user-secrets set "Jwt:Audience" "StockMasterClient"
```

These values are examples only. Use settings appropriate for your environment, and never commit real secrets.

### 3. Run the Backend

1. Open `StockMaster.API.sln` in Visual Studio 2022.
2. Select `StockMaster.API` as the startup project.
3. Select the HTTPS launch profile.
4. Run the application.

Swagger is available in the development environment, typically at:

```text
https://localhost:7106/swagger
```

The exact port may vary according to the local launch settings.

### 4. Run the Frontend

Open a terminal in the frontend directory:

```bash
cd stockmaster.client
npm install
npm run dev
```

Open the local address displayed by Vite,