# Travel CRM

A full-stack Travel CRM (MERN) — a clone of the Sembark trip-management workflow.
Manages the full sales lifecycle: **Query → Quote → Booking → Trip → Accounting**.

## Stack

| Layer    | Tech |
|----------|------|
| Frontend | React 18 + Vite + Tailwind CSS + React Router + TanStack Query |
| Backend  | Node.js + Express + Mongoose |
| Database | MongoDB (Atlas or local) |
| Auth     | JWT (access tokens) + role-based access control |

## Project structure

```
Travel-CRM/
├── server/        # Express + Mongoose REST API
│   └── src/
│       ├── config/        # db + env
│       ├── models/        # Mongoose schemas
│       ├── controllers/   # route handlers
│       ├── routes/        # Express routers
│       ├── middleware/    # auth, error handling
│       ├── validators/    # request validation
│       └── utils/         # helpers
└── client/        # React + Vite SPA
    └── src/
        ├── api/           # axios client + endpoints
        ├── components/    # shared UI
        ├── layouts/       # app shell
        ├── pages/         # route pages
        ├── hooks/         # custom hooks
        └── store/         # auth context
```

## Modules (all built ✅)

0. **Foundation** — scaffold, tooling, env
1. **Auth & RBAC** — users, teams, JWT, app shell
2. **Core config** — destinations, query sources, tags, sales teams
3. **Queries / Leads** — pipeline with status tabs, New Query form
6. **Suppliers / Services** — hotels (+rate cards), transport (+prices), activities (+prices)
4. **Quotes & Itinerary** — day-wise builder, auto-costing from inventory, markup, multi-currency, printable quote
5. **Bookings & Operations** — quote→booking, voucher print, balance tracking
7. **Accounting** — customer payments, supplier ledger, proforma invoices
8. **Sales Reports & MIS** — revenue / leads / quotes / conversion / dropped + CSV export
9. **Polish** — global search, role-based nav, production serving

> Built 6 before 4 deliberately: the quote builder consumes the Services inventory.

## Roles & permissions

`admin` · `manager` · `sales` · `operations` · `accounts`. Reads are open to any
authenticated user; writes are role-gated (e.g. inventory = ops/management,
payments = accounts/management). The navbar hides Accounting/Services for roles
that can't use them.

## Production

```bash
# 1. Build the client
npm run build                      # outputs client/dist

# 2. Set production env in server/.env
#    NODE_ENV=production
#    MONGODB_URI=<your atlas uri>
#    JWT_SECRET=<long random string>

# 3. Start — the server serves the API AND the built client (SPA fallback)
npm start                          # http://localhost:5000
```

The Express server hosts `client/dist` when `NODE_ENV=production`, so a single
process serves the whole app. For a split deploy, host the client (Netlify/Vercel)
and point it at the API with the dev proxy replaced by `VITE_API_URL`.

## Getting started

### 1. Server

```bash
cd server
cp .env.example .env       # then edit MONGODB_URI + JWT_SECRET
npm install
npm run seed               # creates an admin user + sample master data
npm run dev                # http://localhost:5000
```

### 2. Client

```bash
cd client
npm install
npm run dev                # http://localhost:5173
```

The client proxies `/api` to the server in dev (see `vite.config.js`).

## Environment variables (server/.env)

| Var           | Description                                  |
|---------------|----------------------------------------------|
| `PORT`        | API port (default 5000)                       |
| `MONGODB_URI` | MongoDB connection string (Atlas or local)    |
| `JWT_SECRET`  | Secret for signing access tokens              |
| `JWT_EXPIRES` | Token lifetime, e.g. `7d`                      |
| `CLIENT_URL`  | Allowed CORS origin (default http://localhost:5173) |
