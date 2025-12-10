from typing import Iterator, TextIO, BinaryIO
import io

def local_file_down(path: str) -> Iterator[bytes]:
    with open(path, 'rb') as f:
        return f.read()

def s3_file_down(link: str) -> Iterator[bytes]:
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ImportError:
        raise ImportError("boto3 is required ")


    parts = link.replace('s3://','').replace('s3a://','').split('/',1)
    bucket, key = parts[0], parts[1] if len(parts)>1 else ""

    try:
        s3 = boto3.client('s3')
        res = s3.get_object(Bucket = bucket, key=key)
        return res['Body'].read()
    except ClientError  as e:
        raise FileNotFoundError(f'S3 file not found: {s3}') from e


def http_down(link: str) -> Iterator[bytes]:
    import urllib.request

    with urllib.request.urlopen(link) as res:
        return res.read()
