# MandoDesk (Assignment-Ready)

A helpdesk/ticketing system with **role-based dashboards**, **analytics**, **agent assignment UI**, and improved seeding.

## Tech
- Node.js + Express
- MongoDB (Mongoose)
- JWT auth
- React (single-file UI served statically)

## Features
- Roles: `customer`, `agent`, `admin`
- Customers: create/list/view own tickets, comment
- Agents: see assigned tickets, update status, comment
- Admins: see all tickets, assign agents, update status, view analytics
- Analytics endpoint: `GET /api/tickets/__stats/summary`

## Quickstart (Local)
```bash
npm install
cp .env.example .env
# ensure Mongo is running (local or Atlas)
npm run seed:users
npm run dev
# open http://localhost:4000
```

### Seeded accounts
- Admin: `admin@mandodesk.dev` / `admin123`
- Agent: `agent@mandodesk.dev` / `agent123`
- Customer: `customer@mandodesk.dev` / `customer123`

## Deployment (Render + MongoDB Atlas)
1. Push to GitHub.
2. Create free MongoDB Atlas cluster → get connection string.
3. On Render → New Web Service
   - Build: `npm install`
   - Start: `npm start`
   - Environment variables:
     - `MONGODB_URI=<your atlas uri>`
     - `JWT_SECRET=<your secret>`
     - (optional) `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `AGENT_EMAIL`, `AGENT_PASSWORD`, `CUSTOMER_EMAIL`, `CUSTOMER_PASSWORD`
4. After first deploy, run locally `npm run seed:users` pointing to the same `MONGODB_URI` to create users.

## API
- `POST /api/auth/register` {name,email,password,role?}
- `POST /api/auth/login` {email,password}
- `GET /api/users?role=agent` (admin) → list agents
- `POST /api/tickets` (auth) → create
- `GET /api/tickets` (auth, role-based results)
- `GET /api/tickets/:id` (auth, access guarded by role/ownership)
- `PUT /api/tickets/:id` (agent/admin) → { status?, assignedTo? }
- `POST /api/tickets/:id/comments` (auth) → add comment
- `GET /api/tickets/__stats/summary` (admin) → { byStatus, byAgent, avgResolutionHours }

## Notes
- `closedAt` auto-populates when status becomes `Resolved` or `Closed`, used for average resolution time.
- Frontend is intentionally minimal and dependency-free to keep setup simple for assignments.
