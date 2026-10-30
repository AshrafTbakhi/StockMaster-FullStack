# StockMaster — Inventory & Sales Management System

StockMaster is a full-stack inventory and sales management application built to simplify product tracking, sales operations, stock monitoring, and employee management.

The project demonstrates practical full-stack development using ASP.NET Core Web API, React, and Microsoft SQL Server.

## Tech Stack

**Frontend**
- React
- Vite
- JavaScript
- HTML and CSS

**Backend**
- ASP.NET Core 8 Web API
- C#
- Entity Framework Core
- JWT Authentication and Role-Based Authorization

**Database**
- Microsoft SQL Server

**Testing**
- xUnit Integration Tests

## Key Features

- Secure user authentication using JWT
- Role-based access control for Admin and Employee accounts
- Product management
- Category management
- Supplier management
- Sales management
- Stock movement tracking
- Dashboard for inventory and sales information
- Employee account management
- API documentation through Swagger

## User Roles

### Admin
- Manage employee accounts
- Access administrative features
- Manage inventory and sales operations

### Employee
- Access permitted inventory and sales features
- Perform operations according to assigned permissions

The application enforces role-based authorization on the backend.

## Project Structure

```text
StockMaster-FullStack/
├── StockMaster.API/
├── StockMaster.API.Tests/
├── StockMaster.DevTools/
├── stockmaster.client/
└── StockMaster.API.sln
```

## Getting Started

### Prerequisites

- .NET 8 SDK
- Node.js and npm
- Microsoft SQL Server
- Visual Studio 2022 or another compatible IDE

### Backend

1. Open `StockMaster.API.sln`.
2. Configure a local SQL Server database connection.
3. Configure the required JWT settings securely using .NET User Secrets or environment variables.
4. Prepare the database schema.
5. Run the ASP.NET Core API project.

Swagger is available when enabled in the development environment.

### Frontend

Navigate to the frontend directory:

```bash
cd stockmaster.client
npm install
npm run dev
```

Ensure the frontend API configuration points to your running backend.

## Security

StockMaster uses JWT-based authentication and backend authorization checks.

Sensitive configuration values, such as database credentials and JWT signing keys, should be stored securely and must not be committed to the repository.

## Screenshots

Application screenshots will be added here.

## Project Purpose

StockMaster was developed as a practical full-stack training and portfolio project, focusing on backend API development, database integration, frontend implementation, authentication, authorization, and automated testing.

## Future Improvements

- Additional automated testing
- Deployment configuration
- Reporting and analytics enhancements
- Further user experience improvements

## License

No license has been specified for this repository.
