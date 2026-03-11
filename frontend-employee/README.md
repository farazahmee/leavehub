# WorkForceHub - Employee Portal

Separate employee portal running on **port 5175** (different from the main admin portal on 5174).

## Run

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the backend (from project root):
   ```bash
   cd backend && uvicorn main:app --reload --port 8080
   ```

3. Start the employee portal:
   ```bash
   npm run dev
   ```

4. Open **http://localhost:5175** in your browser.

## URLs

| App             | URL                 | Port |
|-----------------|---------------------|------|
| Admin Portal    | http://localhost:5174 | 5174 |
| Employee Portal | http://localhost:5175 | 5175 |
| Backend API     | http://localhost:8080 | 8080 |
