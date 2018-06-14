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
        self._bucketname = 'streamlit-armando'
        self._region = 'us-west-2'
        self._domain = 's3-us-west-2.amazonaws.com'
        self._cloud_root = 'something_else'

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
                LOGGER.debug('upload: %s', filename)

    @run_on_executor
    def _bucket_exists(self):
        try:
            print(self._client.head_bucket(Bucket=self._bucketname))
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
            yield self._upload_static_dir()

        except botocore.exceptions.NoCredentialsError:
            LOGGER.error('please set "AWS_ACCESS_KEY_ID" and "AWS_SECRET_ACCESS_KEY" environment variables')
            raise errors.S3NoCredentials

    def _s3_key(self, relative_path):
        """Convert a local file path into an s3 key (ie path)."""
        return os.path.normpath(
            os.path.join(self._cloud_root, self._release_hash, relative_path))

    @run_on_executor
    def upload_report(self, report_id, report):
        """Save report to s3."""
        self.s3_init()
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
            LOGGER.debug('Uploaded %s', path)

        # Return the url for the saved report.
        full_path = os.path.join(self._bucketname, self._s3_key('index.html'))
        return 'https://%s/%s?id=%s' % (self._domain, full_path, report_id)


'''
class S3Connection(object):
    """Handles a connecton to an S3 bucket to send Report data."""
        raise errors.NoStaticFiles('Cannot find static files. Run "make build".')

    def __init__(self):
        # This is the bucket where we're saving the data.
        self._bucket = 'streamlit-test10'

        # Get the static files which need to be saved and their release hash.
        static_root = config.get_path('proxy.staticRoot')
        all_files = glob.iglob(os.path.join(static_root, '**'), recursive=True)
        self._static_data = []
        md5 = hashlib.md5()
        found_index = False
        for filename in sorted(all_files):
            if os.path.isfile(filename):
                relative_path = os.path.relpath(filename, static_root)
                found_index = found_index or filename.endswith('index.html')
                with open(filename, 'rb') as input:
                    file_data = input.read()
                    self._static_data.append((relative_path, file_data))
                    md5.update(file_data)
        assert found_index, "Cannot find static files. Run 'make build'."
        self._release_hash = f'{streamlit.__version__}-{md5.digest().hex()}'

    async def upload_report(self, report_id, report):
        """Saves this report to our s3 bucket."""
        session = aiobotocore.get_session()
        async with session.create_client('s3') as client:
            # Figure out what we need to save
            serialized_report = report.SerializeToString()
            save_data = [(f'reports/{report_id}.protobuf', serialized_report)]
            if not await self._already_saved_static_content(client):
                save_data.extend(self._static_data)

            # Save all the data
            for path, data in save_data:
                mime_type = mimetypes.guess_type(path)[0]
                if not mime_type:
                    mime_type = 'application/octet-stream'
                await client.put_object(Bucket=self._bucket, Body=data,
                    Key=self._s3_key(path), ContentType=mime_type,
                    ACL='public-read')

        # Return the url for the saved report.
        domain = 's3-us-west-2.amazonaws.com'
        full_path = self._bucket + '/' + self._s3_key('index.html')
        return f'https://{domain}/{full_path}?id={report_id}'

    async def _already_saved_static_content(self, client):
        """Returns true if we've already saved the static content in the
        bucket."""
        # print('Looking for the key!!!')
        # return True
        # index_key = self._s3_key('index.html')
        # resp = await client.get_object_acl(Bucket=self._bucket, Key=index_key)
        # print(resp)
        # # await client.Object(self._bucket, index_key).get()
        # print('Forcing reply true')
        # return True
        index_key = self._s3_key('index.html')
        response = await client.list_objects_v2(
            Bucket=self._bucket, Prefix=index_key)
        for obj in response.get('Contents', []):
            # print('Checking out', obj['Key'])
            if obj['Key'] == index_key:
                # print('Found the key!')
                return True
        # print('Did not find the key.')
        return False

'''
