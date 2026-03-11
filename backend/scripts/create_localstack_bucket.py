"""
Create S3 bucket in LocalStack (or any S3-compatible endpoint).
Run after LocalStack is up. Usage:
  python -m scripts.create_localstack_bucket

Uses AWS_* from .env (e.g. AWS_S3_ENDPOINT_URL=http://127.0.0.1:4566, AWS_S3_BUCKET_NAME=workforcehub-uploads).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from core.config import settings


def main():
    if not settings.AWS_S3_BUCKET_NAME or not settings.AWS_S3_ENDPOINT_URL:
        print("Set AWS_S3_BUCKET_NAME and AWS_S3_ENDPOINT_URL in .env (e.g. for LocalStack).")
        sys.exit(1)
    try:
        import boto3
        from botocore.config import Config
        client = boto3.client(
            "s3",
            region_name=settings.AWS_REGION,
            endpoint_url=settings.AWS_S3_ENDPOINT_URL,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID or "test",
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY or "test",
            config=Config(signature_version="s3v4"),
        )
        client.create_bucket(Bucket=settings.AWS_S3_BUCKET_NAME)
        print(f"Bucket '{settings.AWS_S3_BUCKET_NAME}' created at {settings.AWS_S3_ENDPOINT_URL}")
    except Exception as e:
        if "BucketAlreadyOwnedByYou" in str(e) or "AlreadyExists" in str(e):
            print(f"Bucket '{settings.AWS_S3_BUCKET_NAME}' already exists.")
        else:
            print(f"Error: {e}")
            sys.exit(1)


if __name__ == "__main__":
    main()
