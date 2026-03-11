#!/bin/bash
# Auto-create the S3 bucket when LocalStack starts.
awslocal s3 mb s3://workforcehub-uploads 2>/dev/null || true
echo "Bucket 'workforcehub-uploads' ready."
