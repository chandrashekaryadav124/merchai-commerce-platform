# AI Commerce Discovery & Customer Support Platform

A production-minded, full-stack multi-seller ecommerce marketplace with AI-powered product discovery, RAG seller copilot, demand forecasting, and customer support ticket governance.

---

## 🚀 Technology Stack

- **Frontend**: React 19 + TypeScript + Vite + TailwindCSS
- **Backend**: Python FastAPI + Uvicorn
- **Database**: MySQL 8.0 (`ai_commerce_cleaned` database, 23 tables, >100k records)
- **ORM / Database Driver**: SQLAlchemy 2.0 with `mysqlclient` (MySQL native driver)
- **Security & Auth**: Secure Bcrypt password hashing + PyJWT Bearer authentication + Server-side Role-Based Access Control (RBAC)
- **AI Services**: Server-side LLM copilot layer + RAG Knowledge query engine + ML Demand forecasting & Fraud Radar

---

## 📁 Project Architecture & Structure

```
Team_project/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI Application Entry & Middleware
│   │   ├── core/                    # Security, Config & Dependencies
│   │   │   ├── config.py            # Environment-driven settings & MySQL URI
│   │   │   ├── security.py          # Bcrypt hashing & PyJWT token management
│   │   │   └── deps.py              # Auth & Role verification dependencies
│   │   ├── db/                      # SQLAlchemy Database Session & Health
│   │   │   ├── session.py           # MySQL Connection Engine & Session Local
│   │   │   └── base.py              # Declarative Base Export
│   │   ├── models/                  # SQLAlchemy ORM Models matching 23 tables
│   │   │   ├── users.py             # AppUser model
│   │   │   ├── sellers.py           # Seller & SellerProduct models
│   │   │   ├── products.py          # Product, ProductImage, ProductKnowledge
│   │   │   ├── orders.py            # Order, OrderItem, SellerOrder models
│   │   │   ├── support.py           # SupportTicket model
│   │   │   ├── audit.py             # AuditLog model
│   │   │   └── cart.py              # Cart & CartItem models
│   │   ├── schemas/                 # Pydantic Request / Response Schemas
│   │   │   ├── auth.py              # Login, Token & Registration schemas
│   │   │   ├── products.py          # Product schemas & filter responses
│   │   │   ├── sellers.py           # Seller store schemas
│   │   │   ├── orders.py            # Order creation & line item schemas
│   │   │   ├── support.py           # Support ticket lifecycle schemas
│   │   │   └── analytics.py        # Admin metrics & Fraud Radar schemas
│   │   ├── api/                     # REST API Endpoints
│   │   │   ├── router.py            # Master API Router
│   │   │   └── v1/endpoints/        # Modular Endpoint Handlers
│   │   │       ├── health.py        # /health and /api/health/db
│   │   │       ├── auth.py          # Authentication & Account setup
│   │   │       ├── products.py      # Product catalog & creation
│   │   │       ├── sellers.py       # Seller storefronts
│   │   │       ├── orders.py        # Order placement & customer restrictions
│   │   │       ├── support.py       # Customer support tickets desk
│   │   │       ├── analytics.py     # Platform GMV & Fraud Radar
│   │   │       └── ai.py            # GenAI Listing, Shopping & RAG endpoints
│   │   └── services/                # Business Intelligence Services
│   │       ├── genai_service.py     # Copilot & RAG engines
│   │       ├── ml_service.py        # Demand forecasting & Fraud radar
│   │       └── audit_service.py     # Compliance Audit Logging helper
│   └── tests/
│       └── test_health.py           # API & DB Health Unit Tests
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Customer/            # Customer Discovery & Storefront
│   │   │   ├── Seller/              # Seller Store Management & AI Advisor
│   │   │   ├── Operations/          # Operations Command Desk & Logistics
│   │   │   ├── Support/             # Support Ticket Desk & Resolution
│   │   │   ├── Admin/               # Admin Risk Radar & GMV Metrics
│   │   │   └── Auth/                # Login & Activation Modal
│   │   ├── services/
│   │   │   └── api.ts               # Reusable API Client with Auth headers
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript definitions for 5 roles
│   │   ├── App.tsx                  # Main Shell & Unified Role Switcher
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
├── sql/
│   └── schema_overview.sql          # MySQL Database DDL & Table Structure
├── .env                             # Environment Credentials (Local)
├── .env.example                     # Environment Template
├── .gitignore                       # Git Exclusion File
└── README.md                        # Documentation
```

---

## 🔐 5 Unified User Roles & Permissions

1. **Customer**: Browse product catalog, place orders, track purchases, interact with AI Shopping Assistant, submit support tickets.
2. **Seller**: Manage seller product catalog, generate AI product listings, query RAG knowledge base, inspect demand forecasting.
3. **Operations**: Monitor logistics pipeline, track warehouse shipments, verify database connection health, inspect fulfillment SLAs.
4. **Customer Support**: Manage customer support tickets (`support_tickets`), update ticket resolution status, write agent guidance.
5. **Admin**: Governance desk, monitor platform GMV, active sellers, total orders, and real-time Fraud Radar risk alerts.

---

## 🛠️ Safe Local Development Setup

### 1. Database Prerequisites (Separate Local Development Database)
Ensure a local MySQL 8.0 server is running on `127.0.0.1:3306`.
Create separate local development and test databases:
```sql
CREATE DATABASE IF NOT EXISTS ai_commerce_dev;
CREATE DATABASE IF NOT EXISTS ai_commerce_test;
```

Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
Ensure `.env` contains local development values:
```env
APP_ENV=development
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DB=ai_commerce_dev
MYSQL_TEST_DB=ai_commerce_test
MYSQL_SSL_MODE=DISABLED
```
> [!IMPORTANT]
> **Production Safeguard**: The application includes strict safeguards that automatically block local development commands and tests from connecting to or modifying the production Aiven cloud database. Never put production database credentials in your local `.env`.

### 2. Running the FastAPI Backend
From the project root directory:
```bash
# Navigate to backend directory
cd backend

# Start the uvicorn development server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The FastAPI backend will run on `http://localhost:8000`.
- **API Health Check**: `http://localhost:8000/health`
- **Database Connectivity Check**: `http://localhost:8000/api/health/db`
- **Swagger API Documentation**: `http://localhost:8000/docs`

### 3. Running the React Frontend
In a new terminal, from the `frontend` directory:
```bash
cd frontend
npm run dev
```
The frontend SPA will run on `http://localhost:5173`.

---

## 🧪 Verification & Testing

### 1. Running Isolated Security & Health Tests
```bash
pytest backend/tests/test_security_safeguards.py backend/tests/test_health.py -v
```

### 2. Running the Backend Test Suite (Against Isolated Test Database)
```bash
python backend/run_tests.py
```
> [!NOTE]
> `backend/run_tests.py` automatically forces `APP_ENV=testing` and requires an active local test database (`ai_commerce_test`). It strictly halts if pointed to any production cloud host.

### 3. Frontend Build Verification
```bash
cd frontend
npm run build
```
