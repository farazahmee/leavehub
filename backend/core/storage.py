"""
Storage abstraction: local disk or S3 (e.g. LocalStack).

When AWS_S3_ENDPOINT_URL and AWS_S3_BUCKET_NAME are set, files go to S3;
otherwise to UPLOAD_DIR.

Keys follow the convention ``{tenant_slug}/{category}/{uuid}.{ext}``
so each tenant's files are namespaced within the same bucket.
"""
from pathlib import Path
from typing import Optional, Tuple
import uuid

from core.config import settings
import logging


S3_KEY_PREFIX = "s3/"


def _use_s3() -> bool:
    return bool(settings.AWS_S3_BUCKET_NAME and settings.AWS_S3_ENDPOINT_URL)


def _s3_client():
    """Lazy boto3 S3 client with optional custom endpoint (LocalStack)."""
    import boto3
    from botocore.config import Config
    kwargs = {
        "region_name": settings.AWS_REGION,
        "config": Config(signature_version="s3v4"),
    }
    if settings.AWS_ACCESS_KEY_ID:
        kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
    if settings.AWS_SECRET_ACCESS_KEY:
        kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY
    if settings.AWS_S3_ENDPOINT_URL:
        kwargs["endpoint_url"] = settings.AWS_S3_ENDPOINT_URL
    return boto3.client("s3", **kwargs)


# ---------------------------------------------------------------------------
# Core CRUD
# ---------------------------------------------------------------------------

def save_file(relative_key: str, content: bytes) -> str:
    """
    Save file to local disk or S3. Returns the path/key to store in DB.
    ``relative_key`` should already include the tenant slug prefix, e.g.
    ``acme-corp/documents/abc123.pdf``.
    """
    if _use_s3():
        try:
            client = _s3_client()
            client.put_object(
                Bucket=settings.AWS_S3_BUCKET_NAME,
                Key=relative_key,
                Body=content,
            )
            return S3_KEY_PREFIX + relative_key
        except Exception as e:
            # Fall back to local disk if S3 is misconfigured or unavailable.
            logging.getLogger(__name__).warning(
                "S3 save_file failed, falling back to local storage: %s", e
            )
    full_path = settings.UPLOAD_DIR / relative_key
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_bytes(content)
    return str(full_path)


def read_file(stored_path: str) -> bytes:
    """Read file bytes from local path or S3."""
    source_type, path_or_key = resolve_file_source(stored_path)
    if source_type == "s3":
        client = _s3_client()
        resp = client.get_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=path_or_key)
        return resp["Body"].read()
    return Path(path_or_key).read_bytes()


def delete_file(stored_path: str) -> bool:
    """Delete file from S3 or local disk. Returns True on success."""
    source_type, path_or_key = resolve_file_source(stored_path)
    try:
        if source_type == "s3":
            _s3_client().delete_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=path_or_key)
        else:
            p = Path(path_or_key)
            if p.is_file():
                p.unlink()
        return True
    except Exception:
        return False


def file_exists(stored_path: str) -> bool:
    """Check if file exists (local or S3)."""
    source_type, path_or_key = resolve_file_source(stored_path)
    if source_type == "s3":
        try:
            _s3_client().head_object(Bucket=settings.AWS_S3_BUCKET_NAME, Key=path_or_key)
            return True
        except Exception:
            return False
    return Path(path_or_key).is_file()


# ---------------------------------------------------------------------------
# Pre-signed URLs (S3-only, useful for large downloads without proxying)
# ---------------------------------------------------------------------------

def get_presigned_url(stored_path: str, expires: int = 3600) -> Optional[str]:
    """
    Generate a pre-signed GET URL for the given stored path.
    Returns None if the file is local (callers should stream bytes instead).
    """
    source_type, key = resolve_file_source(stored_path)
    if source_type != "s3":
        return None
    return _s3_client().generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_S3_BUCKET_NAME, "Key": key},
        ExpiresIn=expires,
    )


# ---------------------------------------------------------------------------
# Key generation helpers
# ---------------------------------------------------------------------------

def generate_unique_key(folder: str, extension: str) -> str:
    """Generate ``folder/uuid.extension``."""
    ext = (extension.lstrip(".") or "bin")[:20]
    return f"{folder.rstrip('/')}/{uuid.uuid4().hex}.{ext}"


def tenant_key(tenant_slug: str, category: str, extension: str) -> str:
    """Shorthand: ``{tenant_slug}/{category}/{uuid}.{ext}``."""
    return generate_unique_key(f"{tenant_slug}/{category}", extension)


def resolve_file_source(stored_path: str) -> Tuple[str, str]:
    """
    Returns (source_type, path_or_key).
    source_type is 's3' or 'local'. path_or_key is S3 key (no prefix) or local path.
    """
    if stored_path.startswith(S3_KEY_PREFIX):
        return ("s3", stored_path[len(S3_KEY_PREFIX):])
    return ("local", stored_path)


# ---------------------------------------------------------------------------
# Bucket initialization (idempotent)
# ---------------------------------------------------------------------------

def ensure_bucket_exists() -> None:
    """Create the S3 bucket if it doesn't exist (for LocalStack / dev setup)."""
    if not _use_s3():
        return
    client = _s3_client()
    try:
        client.head_bucket(Bucket=settings.AWS_S3_BUCKET_NAME)
    except Exception:
        try:
            client.create_bucket(Bucket=settings.AWS_S3_BUCKET_NAME)
        except Exception:
            pass
