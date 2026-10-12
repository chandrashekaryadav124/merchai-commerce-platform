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

## 🛠️ Step-by-Step Local Run Instructions

### 1. Database Prerequisites
Ensure MySQL 8.0 server is running on `localhost:3306` with the `ai_commerce_cleaned` database created and populated.
Verify credentials in `.env`:
```env
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=your_db_user
MYSQL_PASSWORD=your_db_password_here
MYSQL_DB=ai_commerce_cleaned
```

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
# Navigate to frontend directory
cd frontend

# Start the Vite development server
npm run dev
```
The application will open on `http://localhost:5173`.

---

## 🧪 Verification & Testing

To run the automated API and Database connection verification suite:
```bash
python scratch/run_backend_tests.py
```
Expected output:
```
1. Testing GET /health... Status: 200 OK (online)
2. Testing GET /api/health/db... Status: 200 OK (healthy, database_connected: True, total_tables: 23)
3. Testing GET /api/v1/products... Status: 200 OK (total products: 550)
ALL TESTS PASSED PERFECTLY!
```
