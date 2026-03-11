-- Run this if you have existing users table and need to add password reset columns
-- psql -U postgres -d workforcehub -f migrations/add_password_reset_columns.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS ix_users_password_reset_token ON users (password_reset_token);
