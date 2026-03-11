-- Allow same employee_id in different tenants (e.g. EMP0001 per tenant).
-- Run if you have an existing employees table: psql -U postgres -d <your_db> -f migrations/employee_id_per_tenant.sql

-- Drop any existing global uniqueness on employee_id.
-- Depending on how it was created, it might be a constraint or just a unique index.
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_employee_id_key;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS ix_employees_employee_id;
DROP INDEX IF EXISTS ix_employees_employee_id;

-- Add unique (tenant_id, employee_id). Use COALESCE so NULL tenant_id is treated as one bucket.
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_tenant_employee_id
  ON employees (COALESCE(tenant_id, -1), employee_id);
