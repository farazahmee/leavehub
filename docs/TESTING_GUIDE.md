# WorkForceHub – Step-by-Step Testing Guide (Windows 10)

This guide walks you through running and testing the full stack on **Windows 10**, including Super Admin, company admin creation, set-password flow, and optional LocalStack (S3) for file storage.

**What’s implemented:** Multi-tenant companies & roles (Phase 1), tenant middleware (Phase 2), Super Admin API & UI (Phase 3), company admin invite-by-email and set-password, and a storage layer so document/payroll uploads can use **local disk** (default) or **S3 / LocalStack** when configured.

---

## Prerequisites

- **Python 3.10+** (add to PATH)
- **Node.js 18+** (npm included)
- **PostgreSQL** (running; default port 5432)
- **Git** (optional, for cloning)

---

## Step 1: Database setup

1. Create a database named `workforcehub` in PostgreSQL (pgAdmin or `psql`).
2. Note your DB URL. Example:
   ```text
   postgresql+asyncpg://postgres:YOUR_PASSWORD@127.0.0.1:5432/workforcehub
   ```
   On Windows use `127.0.0.1` instead of `localhost` to avoid resolution issues. If the password contains `!`, `@`, or `#`, URL-encode them: `!` → `%21`, `@` → `%40`, `#` → `%23`.

---

## Step 2: Backend setup and Phase 1 migration

1. Open **PowerShell** or **Command Prompt** and go to the backend folder:
   ```powershell
   cd E:\HR-man\backend
   ```

2. Create and activate a virtual environment (if not already done):
   ```powershell
   python -m venv venv
   .\venv\Scripts\activate
   ```

3. Install dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

4. Copy environment file and edit `.env`:
   ```powershell
   copy .env.example .env
   notepad .env
   ```
   Set at least:
   - `DATABASE_URL` – your PostgreSQL URL
   - `JWT_SECRET_KEY` – any long random string
   - `FRONTEND_URL=http://localhost:5174`
   - SMTP settings if you want to test emails (or leave as-is for “email not sent” behavior)

5. Run the **Phase 1 schema migration** (adds companies, roles, tenant_id, user_type, etc.):
   ```powershell
   python -m scripts.migrate_phase1_schema
   ```
   You should see “Phase 1 schema migration completed.” Run it only once per database.

6. Start the backend:
   ```powershell
   python main.py
   ```
   Or with uvicorn:
   ```powershell
   uvicorn main:app --host 0.0.0.0 --port 8080 --reload
   ```
   Backend should be at **http://localhost:8080**. Open **http://localhost:8080/docs** to confirm.

---

## Step 3: Frontend setup and run

1. Open a **new** terminal and go to the frontend folder:
   ```powershell
   cd E:\HR-man\frontend
   ```

2. Install dependencies and start the dev server:
   ```powershell
   npm install
   npm run dev
   ```
   Frontend runs at **http://localhost:5174** and proxies `/api` to the backend (port 8080).

---

## Step 4: Create a Super Admin (first-time)

If you don’t have a super admin yet:

1. **Option A – Database:** Insert a user with `role = 'super_admin'` and set `user_type = 'platform_admin'` (or leave NULL; the app treats `role = 'super_admin'` as platform admin). Ensure they have a valid `hashed_password` (e.g. from an existing signup or script).
2. **Option B – Signup then DB update:** Register normally via the app, then in the database set that user’s `role` to `super_admin` and optionally `user_type` to `platform_admin`.

After that, log in with that user in the frontend.

---

## Step 5: Test Super Admin section

1. Log in as **Super Admin**.
2. In the sidebar you should see **“Super Admin”** (e.g. Shield icon). Click it.
3. **Dashboard:** Stats (companies, users, etc.) should load.
4. **Companies:**
   - Open **Companies** → **Add company**.
   - Create a company (e.g. name “Acme”, slug “acme”). Save.
   - Open the company to see **Roles** and **Users**.
5. **Create company admin:**
   - On the company detail page click **“+ Create company admin”**.
   - Fill: **Email**, **First name**, **Last name**. Username is optional (leave blank to auto-generate from email).
   - Submit. You should see a success message and “Set-password link sent to their email” (if SMTP is configured).
   - In the **Users** list you should see the new user (e.g. with “Company Admin” role).

---

## Step 6: Test set-password flow (company admin)

1. Get the set-password link from the email sent to the company admin (or from logs/DB if you’re not using real email).
2. Link format: `http://localhost:5174/set-password?token=...`
3. Open that link in the browser (same machine or ensure `FRONTEND_URL` matches where you open it).
4. Enter a **new password** (meeting the app’s rules) and submit.
5. You should be **logged in automatically** as that user (company admin). You should **not** see “Super Admin” in the sidebar; you should see the normal HR dashboard (Teams, Employees, etc.) for that company.

---

## Step 7: Test company admin capabilities

Logged in as the **company admin** (after set password):

1. **Teams:** Create a team, list teams.
2. **Employees:** Add employees, list employees.
3. **Documents:** Upload a document (uses local `uploads` folder if S3 is not configured).
4. **Attendance / Leave / Payroll / etc.:** Use the menu to confirm they can access what you expect for a company admin.

---

## Step 8: Quick API checks (optional)

- **Health:** `GET http://localhost:8080/health` → `{"status":"healthy"}`.
- **API docs:** `http://localhost:8080/docs`.
- **Super Admin (needs JWT):** e.g. `GET http://localhost:8080/api/v1/superadmin/companies` with header `Authorization: Bearer <access_token>`.
- **Tenant:** For tenant-scoped endpoints, send `X-Tenant-Slug: acme` (or the company slug) if your frontend doesn’t send it automatically.

---

## Troubleshooting (Windows 10)

| Issue | What to do |
|--------|-------------|
| `getaddrinfo` or DB connection failed | Use `127.0.0.1` in `DATABASE_URL` instead of `localhost`. |
| `column user_type does not exist` | Run Phase 1 migration: `python -m scripts.migrate_phase1_schema` from `backend`. |
| `column tenant_id does not exist` on employees/teams | Same: run Phase 1 migration. |
| Super Admin menu not visible | User must have `role === 'super_admin'` or `user_type === 'platform_admin'`. |
| Set-password link 404 | Frontend must be served at `FRONTEND_URL` (e.g. http://localhost:5174). |
| CORS errors | Ensure `CORS_ORIGINS` in backend `.env` includes `http://localhost:5174`. |
| Port 8080 or 5174 in use | Change `PORT` in backend or Vite port in `frontend/vite.config.js`. |

---

## Summary

- **Backend:** `cd backend` → `venv` → `pip install -r requirements.txt` → set `.env` → `python -m scripts.migrate_phase1_schema` → `python main.py` (or uvicorn).
- **Frontend:** `cd frontend` → `npm install` → `npm run dev`.
- **Test path:** Super Admin → create company → create company admin (email flow) → open set-password link → set password → use app as company admin (teams, employees, etc.).

**Optional – LocalStack (S3) for uploads:** When `AWS_S3_ENDPOINT_URL` and `AWS_S3_BUCKET_NAME` are set in `.env`, document and payroll uploads go to S3 (e.g. LocalStack). See **LOCALSTACK_SETUP_WINDOWS.md** for Docker and bucket setup on Windows 10.
