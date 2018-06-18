"""Handles a connecton to an S3 bucket to send Report data."""
import binascii
import hashlib
import logging
import mimetypes
import os

import boto3
import botocore
import streamlit

from tornado import gen
from tornado.concurrent import run_on_executor, futures

from streamlit.logger import get_logger
from streamlit import errors
from streamlit import config

LOGGER = get_logger()


class Cloud(object):
    """Generic Cloud class for either S3 or GCS."""

    def __init__(self):
        """Constructor."""
        dirname = os.path.dirname(os.path.normpath(__file__))
        self._static_dir = os.path.normpath(os.path.join(dirname, 'static'))
        self._static_files = self._get_static_files()

        md5 = hashlib.md5()
        md5.update(
            open(os.path.join(self._static_dir, 'index.html'), 'rb').read())
        self._release_hash = '%s-%s' % (streamlit.__version__, binascii.hexlify(md5.digest()))

    def _get_static_dir(self):
        """Return static directory location."""
        return self._static_dir

    def _get_static_files(self):
        """Return relative path of all static files in a list."""
        files = []
        for root, dirnames, filenames in os.walk(self._static_dir):
            for filename in filenames:
                f = os.path.relpath(
                    os.path.join(root, filename),
                    self._static_dir)
                files.append(f)
        if not files:
            raise errors.NoStaticFiles('Cannot find static files. Run "make build".')
        return files


class S3(Cloud):
    """Class to handle S3 uploads."""

    executor = futures.ThreadPoolExecutor(5)

    def __init__(self):
        """Constructor."""
        super(S3, self).__init__()

        # For now don't enable verbose boto logs
        # TODO(armando): Make this configurable.
        log = logging.getLogger('botocore')
        log.propagate = False

        # Config related stuff.
        self._bucketname = config.get_option('s3.bucketname')
        self._url = config.get_option('s3.url')
        self._key_prefix = config.get_option('s3.key_prefix')
        self._region = config.get_option('s3.region')

        user = os.getenv('USER', None)

        if self._url and '{USER}' in self._url:
            self._url = self._url.replace('{USER}', user)
        if self._key_prefix and '{USER}' in self._key_prefix:
            self._key_prefix = self._key_prefix.replace('{USER}', user)

        if self._key_prefix is None:
            self._key_prefix = ''

        if not self._url:
            self._s3_url = os.path.join('https://%s.%s' % (self._bucketname, 's3.amazonaws.com'), self._s3_key('index.html'))
        else:
            self._s3_url = os.path.join(self._url, self._s3_key('index.html', add_prefix=False))

        self._client = boto3.client('s3')

    @run_on_executor
    def _upload_static_dir(self):
        try:
            self._client.head_object(
                Bucket=self._bucketname,
                Key=self._s3_key('index.html'))
        except botocore.exceptions.ClientError:
            for filename in self._static_files:
                mime_type = mimetypes.guess_type(filename)[0]
                if not mime_type:
                    mime_type = 'application/octet-stream'
                self._client.put_object(
                    Bucket=self._bucketname,
                    Body=open(os.path.join(self._static_dir, filename), 'rb').read(),
                    Key=self._s3_key(filename),
                    ContentType=mime_type,
                    ACL='public-read')
                LOGGER.debug('Uploaded: %s', filename)

    @run_on_executor
    def _bucket_exists(self):
        # THIS DOES NOT WORK because the aws exception isn't being
        # caught and disappearing.
        try:
            self._client.head_bucket(Bucket=self._bucketname)
        except botocore.exceptions.ClientError:
            LOGGER.info('"%s" bucket not found', self._bucketname)
            return False
        return True

    @run_on_executor
    def _create_bucket(self):
        LOGGER.info('Attempting to create "%s" bucket', self._bucketname)
        self._client.create_bucket(
            ACL='public-read',
            Bucket=self._bucketname,
            CreateBucketConfiguration={'LocationConstraint': self._region})
        LOGGER.info('"%s" bucket created', self._bucketname)

    @gen.coroutine
    def s3_init(self):
        """Initialize s3 bucket."""
        try:
            bucket_exists = yield self._bucket_exists()
            if not bucket_exists:
                yield self._create_bucket()

        except botocore.exceptions.NoCredentialsError:
            LOGGER.error('please set "AWS_ACCESS_KEY_ID" and "AWS_SECRET_ACCESS_KEY" environment variables')
            raise errors.S3NoCredentials

    def _s3_key(self, relative_path, add_prefix=True):
        """Convert a local file path into an s3 key (ie path)."""
        key = os.path.join(self._release_hash, relative_path)
        if add_prefix:
            key = os.path.join(self._key_prefix, key)
        return os.path.normpath(key)

    @gen.coroutine
    def upload_report(self, report_id, report):
        """Save report to s3."""
        yield self.s3_init()
        yield self._upload_static_dir()
        yield self._s3_upload_report(report_id, report)

        # Return the url for the saved report.
        raise gen.Return('%s?id=%s' % (self._s3_url, report_id))

    @run_on_executor
    def _s3_upload_report(self, report_id, report):
        # Figure out what we need to save
        serialized_report = report.SerializeToString()
        save_data = [('reports/%s.protobuf' % report_id, serialized_report)]

        # Save all the data
        for path, data in save_data:
            mime_type = mimetypes.guess_type(path)[0]
            if not mime_type:
                mime_type = 'application/octet-stream'
            self._client.put_object(
                Bucket=self._bucketname,
                Body=data,
                Key=self._s3_key(path),
                ContentType=mime_type,
                ACL='public-read')
            LOGGER.debug('Uploaded: %s', path)
