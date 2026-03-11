"""
Input validation utilities
"""
import os
import re
from typing import Optional
from fastapi import HTTPException, status


def validate_email(email: str) -> bool:
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_phone(phone: str) -> bool:
    """Validate phone number format"""
    # Remove spaces, dashes, and parentheses
    cleaned = re.sub(r'[\s\-\(\)]', '', phone)
    # Check if it's all digits and has reasonable length
    return cleaned.isdigit() and 10 <= len(cleaned) <= 15


def sanitize_string(value: str, max_length: Optional[int] = None) -> str:
    """Sanitize string input"""
    # Remove null bytes and trim whitespace
    sanitized = value.replace('\x00', '').strip()
    if max_length and len(sanitized) > max_length:
        sanitized = sanitized[:max_length]
    return sanitized


def validate_file_extension(filename: str, allowed_extensions: list[str]) -> bool:
    """Validate file extension"""
    if not filename:
        return False
    ext = filename.rsplit('.', 1)[-1].lower()
    return ext in allowed_extensions


def validate_file_size(file_size: int, max_size: int) -> bool:
    """Validate file size"""
    return file_size <= max_size


def is_path_safe(file_path, base_dir) -> bool:
    """Ensure resolved path is within base_dir (prevents path traversal)."""
    from pathlib import Path
    base = Path(base_dir).resolve()
    resolved = Path(file_path).resolve()
    try:
        base_str = str(base) + ("" if str(base).endswith(os.sep) else os.sep)
        return str(resolved).startswith(base_str) or str(resolved) == str(base)
    except (ValueError, TypeError):
        return False
