# Resignation Letter Flow – Verification Steps

## 1. Start the servers

Run these in **3 separate terminals**:

### Terminal 1 – Backend
```powershell
cd e:\HR-man\backend
.\venv\Scripts\python.exe run.py
```
Backend runs on **http://localhost:8080**

### Terminal 2 – Admin frontend
```powershell
cd e:\HR-man\frontend
npm run dev
```
Admin app runs on **http://localhost:5174**

### Terminal 3 – Employee portal
```powershell
cd e:\HR-man\frontend-employee
npm run dev
```
Employee app runs on **http://localhost:5175**

---

## 2. Verify the flow

### Step A – Employee submits resignation letter

1. Open **http://localhost:5175** in your browser.
2. Log in with an **employee** account (not admin).
3. Go to **Documents** (sidebar).
4. Click **Submit Resignation Letter**.
5. Enter a sample letter, e.g.:

   ```
   Dear [Manager name],

   Please accept this letter as formal notice of my resignation from my position at the company. My last working day will be [date].

   Thank you for the opportunity to work here. I have learned a lot during my tenure.

   Best regards,
   [Your name]
   ```

6. Click **Submit to Admin**.
7. You should see a success message.

### Step B – Admin views and uses the letter

1. Open **http://localhost:5174** in your browser (or another tab).
2. Log in with an **admin** account.
3. Go to **Letters**.
4. In **Pending Letter Requests**, you should see:
   - Employee name
   - “requested **resignation** letter”
   - The employee’s letter content
5. Click **Create & Send**.
6. The letter form should open with:
   - Employee pre-selected
   - Letter type: Resignation
   - Content pre-filled with the employee’s resignation letter (instead of the template)
7. If desired, edit the content and click **Create & Send to Email**.
8. The request should move out of pending after the letter is created.

---

## 3. Quick commands summary

| Server       | Command                                              |
|-------------|------------------------------------------------------|
| Backend     | `cd e:\HR-man\backend; .\venv\Scripts\python.exe run.py` |
| Admin       | `cd e:\HR-man\frontend; npm run dev`                 |
| Employee    | `cd e:\HR-man\frontend-employee; npm run dev`        |
