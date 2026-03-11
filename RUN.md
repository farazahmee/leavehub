# Running HR-man locally

The frontend (Vite) proxies all `/api` requests to **http://localhost:8080**.  
If the backend is not running, you will see **ECONNREFUSED** in the terminal and data (employees, payroll, letters, etc.) will not load.

## 1. Start the backend (required first)

Open a terminal:

```bash
cd E:\HR-man\backend
# Activate your venv if you use one, e.g.:
#   Windows: venv\Scripts\activate
#   Mac/Linux: source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8080
```

Leave this running. You should see something like: `Uvicorn running on http://0.0.0.0:8080`.

## 2. Start the frontend

Open a **second** terminal:

```bash
cd E:\HR-man\frontend-admin
npm run dev
```

Then open the URL shown (e.g. http://localhost:5176). The proxy will forward `/api` to the backend on port 8080.

## Summary

| If you see…              | Fix |
|--------------------------|-----|
| `[vite] http proxy error: ... ECONNREFUSED` | Backend is not running. Start it on port **8080** (step 1). |
| Employees / payroll / letters empty or not loading | Same as above: start the backend first. |
