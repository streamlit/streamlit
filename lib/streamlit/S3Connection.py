# -*- coding: future_fstrings -*-

"""Handles a connecton to an S3 bucket to send Report data."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

# Standard Library Imports
import base58
import binascii
import boto3
import botocore
import hashlib
import logging
import math
import mimetypes
import os

import streamlit

from tornado import gen
from tornado.concurrent import run_on_executor, futures
from streamlit import errors
from streamlit import config

from streamlit.logger import get_logger
LOGGER = get_logger()


class Cloud(object):
    """Generic Cloud class for either S3 or GCS."""

    def __init__(self):
        """Constructor."""
        dirname = os.path.dirname(os.path.normpath(__file__))
        self._static_dir = os.path.normpath(os.path.join(dirname, 'static'))

        # load the static files and compute the release hash
        self._static_files, md5 = [], hashlib.md5()
        for root, dirnames, filenames in os.walk(self._static_dir):
            for filename in filenames:
                absolute_name = os.path.join(root, filename)
                relative_name = os.path.relpath(absolute_name, self._static_dir)
                with open(absolute_name, 'rb') as input:
                    file_data = input.read()
                    self._static_files.append((relative_name, file_data))
                    md5.update(file_data)
        if not self._static_files:
            raise errors.NoStaticFiles(
                'Cannot find static files. Run "make build".')
        self._release_hash = '%s-%s' % (streamlit.__version__,
            base58.b58encode(md5.digest()[:3]).decode("utf-8"))

    def _get_static_dir(self):
        """Return static directory location."""
        return self._static_dir


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
        self._bucketname = config.get_s3_option('bucket')
        self._url = config.get_s3_option('url')
        self._key_prefix = config.get_s3_option('keyPrefix')
        self._region = config.get_s3_option('region')

        # self._bucketname = config.get_option('s3.bucketname')
        # self._url = config.get_option('s3.url')
        # self._key_prefix = config.get_option('s3.key_prefix')
        # self._region = config.get_option('s3.region')

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

        aws_profile = config.get_s3_option('profile')
        access_key_id = config.get_s3_option('accessKeyId')
        if aws_profile is not None:
            LOGGER.debug(f'Using AWS profile "{aws_profile}".')
            self._client = boto3.Session(profile_name=aws_profile).client('s3')
        elif access_key_id is not None:
            secret_access_key = config.get_s3_option('secretAccessKey')
            self._client = boto3.client(
                's3',
                 aws_access_key_id=access_key_id,
                 aws_secret_access_key=secret_access_key)
        else:
            LOGGER.debug(f'Using default AWS profile.')
            self._client = boto3.client('s3')

    @run_on_executor
    def _get_static_upload_files(self):
        """Returns a list of static files to upload, or an empty list if they're
        already uploaded."""
        try:
            self._client.head_object(
                Bucket=self._bucketname,
                Key=self._s3_key('index.html'))
            return []
        except botocore.exceptions.ClientError:
            return list(self._static_files)

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
    def upload_report(self, report_id, files, progress_coroutine):
        """Save report to s3."""
        yield self.s3_init()
        files_to_upload = yield self._get_static_upload_files()
        yield self._s3_upload_files(files_to_upload + files, progress_coroutine)

        # Return the url for the saved report.
        raise gen.Return('%s?id=%s' % (self._s3_url, report_id))

    @gen.coroutine
    def _s3_upload_files(self, files, progress_coroutine):
        for i, (path, data) in enumerate(files):
            mime_type = mimetypes.guess_type(path)[0]
            if not mime_type:
                mime_type = 'application/octet-stream'
            self._client.put_object(
                Bucket=self._bucketname,
                Body=data,
                Key=self._s3_key(path),
                ContentType=mime_type,
                ACL='public-read')
            LOGGER.debug('Uploaded: "%s"' % path)
            yield progress_coroutine(math.ceil(100 * (i+1) / len(files)))
