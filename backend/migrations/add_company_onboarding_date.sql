-- Add onboarding_date and admin_contact_phone to companies (Create Company / tenant).
-- Run if you have an existing companies table: psql -U postgres -d <your_db> -f migrations/add_company_onboarding_date.sql

ALTER TABLE companies ADD COLUMN IF NOT EXISTS onboarding_date DATE;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS admin_contact_phone VARCHAR(50);
