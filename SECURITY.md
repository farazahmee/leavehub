# Security Notes

## Fixes Applied

### Report Exports
- **Date display**: Leave and Attendance exports now use `DD-MMM-YYYY` format (e.g. 15-Jan-2026) so dates display correctly in Excel instead of `########`.
- **UTF-8 BOM** added to CSV exports for proper Excel encoding on Windows.

### Backend Security
- **Path traversal**: Document download validates that file path stays within `UPLOAD_DIR`.
- **SQL injection**: All queries use SQLAlchemy ORM with parameterized queries.
- **File validation**: Document uploads validate extension and size; filenames are sanitized.
- **Security headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, Referrer-Policy.

### Recommendations

1. **Production**: Set strong `SECRET_KEY`, `JWT_SECRET_KEY` in `.env`. Never use defaults.
2. **Database**: Use strong passwords; consider SSL for PostgreSQL in production.
3. **CORS**: Restrict `CORS_ORIGINS` to your actual frontend URLs.
4. **Dependencies**: Run `pip install -U -r requirements.txt` and `npm audit fix` periodically.
5. **esbuild/Vite**: The dev server vulnerability (GHSA-67mh-4wv8-2f99) affects development only. Production builds are not affected. Consider `npm audit fix` when upgrading.
6. **HTTPS**: Always use HTTPS in production.
