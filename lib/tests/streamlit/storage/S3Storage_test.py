"""S3 Storage Unittest.

Copyright 2019 Streamlit Inc. All rights reserved.
"""
import hashlib
import unittest

from mock import patch

from streamlit.storage.S3Storage import S3Storage
from streamlit.config import set_option


class S3StorageTest(unittest.TestCase):
    def tearDown(self):
        set_option('global.sharingMode', 'off')

    @patch('streamlit.storage.AbstractStorage._get_static_files')
    @patch('streamlit.config._get_public_credentials')
    def test_public_url(self, creds, static_files):
        creds.return_value = {
            'bucket': 'share.streamlit.io',
            'url': 'https://share.streamlit.io/',
            'accessKeyId': 'ACCESS_KEY_ID',
            'secretAccessKey': 'SECRERT_ACCESS_KEY',
        }
        static_files.return_value = [('index.html', 'some data')], hashlib.md5()
        set_option('global.sharingMode', 'streamlit-public')
        s3 = S3Storage()
        self.assertEqual(s3._url, 'https://share.streamlit.io/')

    @patch('streamlit.storage.AbstractStorage._get_static_files')
    def test_private_url(self, static_files):
        static_files.return_value = [('index.html', 'some data')], hashlib.md5()

        set_option('global.sharingMode', 's3')
        set_option('s3.bucket', 'buckets')
        set_option('s3.accessKeyId', 'ACCESS_KEY_ID')
        set_option('s3.secretAccessKey', 'SECRET_ACCESS_KEY')
        s3 = S3Storage()
        self.assertEqual(s3._url, None)
        idx = s3._web_app_url.index('/', 8)
        self.assertEqual(s3._web_app_url[0:idx],
                         'https://buckets.s3.amazonaws.com')
