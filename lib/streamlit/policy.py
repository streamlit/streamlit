"""Generate default public S3 policy."""
import sys

from textwrap import dedent


POLICY = dedent('''{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "VisualEditor0",
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::%(bucket)s",
            "Condition": {
                "StringEquals": {
                    "s3:prefix": "",
                    "s3:delimiter": "/"
                }
            }
        },
        {
            "Sid": "VisualEditor1",
            "Effect": "Allow",
            "Action": "s3:ListBucket",
            "Resource": "arn:aws:s3:::%(bucket)s",
            "Condition": {
                "StringNotLike": {
                    "s3:prefix": [
                        "*/reports",
                        "*/reports/"
                    ]
                }
            }
        },
        {
            "Sid": "VisualEditor2",
            "Effect": "Allow",
            "Action": "s3:PutObjectAcl",
            "Resource": [
                "arn:aws:s3:::%(bucket)s",
                "arn:aws:s3:::%(bucket)s/*"
            ]
        },
        {
            "Sid": "VisualEditor3",
            "Effect": "Allow",
            "Action": "s3:PutObject",
            "Resource": [
                "arn:aws:s3:::%(bucket)s/*/*.json",
                "arn:aws:s3:::%(bucket)s/*/*.js",
                "arn:aws:s3:::%(bucket)s/*/*.html",
                "arn:aws:s3:::%(bucket)s/*/*.ico",
                "arn:aws:s3:::%(bucket)s/*/*.svg",
                "arn:aws:s3:::%(bucket)s/*/emoji/*.png",
                "arn:aws:s3:::%(bucket)s/*/fonts/*.css",
                "arn:aws:s3:::%(bucket)s/*/fonts/*/*.txt",
                "arn:aws:s3:::%(bucket)s/*/fonts/*/*.ttf",
                "arn:aws:s3:::%(bucket)s/*/static/css/*.css",
                "arn:aws:s3:::%(bucket)s/*/static/js/*.js",
                "arn:aws:s3:::%(bucket)s/*/reports/*/manifest.json",
                "arn:aws:s3:::%(bucket)s/*/reports/*/*.delta"
            ]
        }
    ]
}''')


def main():
    print(POLICY % {'bucket': sys.argv[1]})


if __name__ == '__main__':
    main()
