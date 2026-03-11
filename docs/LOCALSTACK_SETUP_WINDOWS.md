# LocalStack Setup on Windows 10

This guide explains how to run **LocalStack** on Windows 10 so you can use S3-compatible storage locally (e.g. for document and payroll file uploads) without real AWS credentials.

---

## What is LocalStack?

LocalStack runs AWS services (S3, etc.) locally in Docker. The WorkForceHub backend can store files in LocalStack S3 when configured via `AWS_S3_ENDPOINT_URL`.

---

## Prerequisites (Windows 10)

1. **Docker Desktop for Windows**
   - Download: https://www.docker.com/products/docker-desktop/
   - Install and start Docker Desktop.
   - Ensure **WSL 2** is enabled (Docker will prompt or use Hyper-V on older setups).
   - In the system tray, Docker should show “Docker Desktop is running”.

2. **Docker Compose**
   - Included with Docker Desktop. Verify in PowerShell:
     ```powershell
     docker compose version
     ```

---

## How to Run – Step-by-Step

### Quick start (automated script)

1. **Set `.env` for LocalStack** – In `backend\.env` add:
   ```env
   AWS_ACCESS_KEY_ID=test
   AWS_SECRET_ACCESS_KEY=test
   AWS_REGION=us-east-1
   AWS_S3_BUCKET_NAME=workforcehub-uploads
   AWS_S3_ENDPOINT_URL=http://127.0.0.1:4566
   ```

2. **Run the setup script** from project root:
   ```powershell
   cd E:\HR-man
   .\scripts\run-localstack-setup.ps1
   ```
   This starts LocalStack, waits for it to be healthy, and creates the S3 bucket.

3. **Restart the backend** (if it was running) and test uploads.

---

### Manual run (step by step)

| Step | Command / action |
|------|------------------|
| **1. Go to project root** | `cd E:\HR-man` |
| **2. Start LocalStack** | `docker compose -f docker-compose.localstack.yml up -d` |
| **3. Wait ~10–20 seconds** | LocalStack needs time to start |
| **4. Verify LocalStack health** | `Invoke-RestMethod -Uri http://127.0.0.1:4566/_localstack/health` (PowerShell) |
| **5. Set `backend\.env`** | Add `AWS_S3_*` vars (see Step 3 below) |
| **6. Create bucket** | From `backend\`: `python -m scripts.create_localstack_bucket` |
| **7. Restart backend** | `python main.py` or `uvicorn main:app --port 8080` |

---

## Step 1: Start LocalStack

1. Open **PowerShell** and go to the project root:
   ```powershell
   cd E:\HR-man
   ```

2. Start LocalStack (S3 only):
   ```powershell
   docker compose -f docker-compose.localstack.yml up -d
   ```

3. Check that the container is running:
   ```powershell
   docker ps
   ```
   You should see `workforcehub-localstack` or similar.

4. **Verify LocalStack health** (optional, after ~15 seconds):
   ```powershell
   Invoke-RestMethod -Uri http://127.0.0.1:4566/_localstack/health -Method Get
   ```
   You should get a JSON response. If it fails, wait longer and retry.

---

## Step 2: Create an S3 bucket

**Option A – Python script (recommended, no AWS CLI needed)**

1. Set `AWS_S3_BUCKET_NAME` and `AWS_S3_ENDPOINT_URL` in `backend\.env` (see Step 3).
2. From the backend folder:
   ```powershell
   cd E:\HR-man\backend
   .\venv\Scripts\activate
   python -m scripts.create_localstack_bucket
   ```

**Option B – AWS CLI**

1. Install [AWS CLI v2](https://awscli.amazonaws.com/AWSCLIV2.msi).
2. Configure dummy credentials:
   ```powershell
   aws configure set aws_access_key_id test
   aws configure set aws_secret_access_key test
   aws configure set region us-east-1
   ```
3. Create the bucket:
   ```powershell
   aws s3 mb s3://workforcehub-uploads --endpoint-url http://localhost:4566
   ```

---

## Step 3: Configure backend to use LocalStack

In `backend\.env` add or update:

```env
# LocalStack S3 (Windows: use 127.0.0.1)
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=workforcehub-uploads
AWS_S3_ENDPOINT_URL=http://127.0.0.1:4566
```

Restart the FastAPI backend after changing `.env`.

---

## Checklist – Verify Each Function

Use this checklist to confirm everything works.

### Infrastructure

| # | Check | How to verify |
|---|-------|---------------|
| 1 | Docker running | `docker info` – no error |
| 2 | LocalStack container up | `docker ps` – see `workforcehub-localstack` |
| 3 | LocalStack health | `Invoke-RestMethod -Uri http://127.0.0.1:4566/_localstack/health` – returns JSON |
| 4 | Bucket exists | `aws s3 ls --endpoint-url http://localhost:4566` (if AWS CLI) – shows `workforcehub-uploads`, or run `create_localstack_bucket.py` successfully |
| 5 | Backend `.env` set | `AWS_S3_BUCKET_NAME=workforcehub-uploads`, `AWS_S3_ENDPOINT_URL=http://127.0.0.1:4566` |
| 6 | Backend restarted | Backend restarted after `.env` changes |

### Document upload / download (Admin frontend)

| # | Check | How to verify |
|---|-------|---------------|
| 7 | Document upload | Admin → Documents → Upload (PDF/DOC, etc.) – no error |
| 8 | Document list | Documents page shows the uploaded file |
| 9 | Document download | Click download – file downloads correctly |

### Payroll upload / download

| # | Check | How to verify |
|---|-------|---------------|
| 10 | Payroll upload | Admin → Payroll → Upload salary slip (PDF) – no error |
| 11 | Payroll list | Payroll page shows the uploaded slip |
| 12 | Payroll download | Employee or Admin downloads the slip – PDF opens correctly |

### S3 verification (optional)

| # | Check | How to verify |
|---|-------|---------------|
| 13 | Objects in S3 | `aws s3 ls s3://workforcehub-uploads/ --endpoint-url http://localhost:4566 --recursive` – shows `documents/` and `payroll/` keys |

---

## Summary of Modifications Made (System)

| File | Modification |
|------|--------------|
| `scripts/run-localstack-setup.ps1` | **New.** Starts LocalStack, waits for health, creates bucket. |
| `backend/.env.example` | **Updated.** Added commented LocalStack example values. |
| `docs/LOCALSTACK_SETUP_WINDOWS.md` | **Updated.** Added run script, manual steps, and checklist. |

**Existing files used (no changes):**
- `docker-compose.localstack.yml` – LocalStack S3 service
- `backend/scripts/create_localstack_bucket.py` – Bucket creation
- `backend/core/storage.py` – S3/local storage abstraction
- `backend/core/config.py` – AWS settings

---

## Troubleshooting (Windows 10)

| Issue | What to do |
|-------|------------|
| Docker daemon not running | Start **Docker Desktop** from the Start menu. |
| “port is already allocated” | Another process uses 4566. Stop it or change port in `docker-compose.localstack.yml` (e.g. `4567:4566`). |
| Backend can’t connect to LocalStack | Use `http://127.0.0.1:4566` in `.env` (not `localhost`). |
| Bucket not found | Create bucket (Step 2). Name must match `AWS_S3_BUCKET_NAME`. |
| SSL/HTTPS errors | LocalStack uses HTTP. Use `http://...`, not `https://`. |

---

## Optional: Use LocalStack only when configured

When `AWS_S3_ENDPOINT_URL` is empty, the app uses local disk (`uploads/`). When set (LocalStack or real AWS), it uses S3. You can switch by editing `.env` and restarting the backend.
