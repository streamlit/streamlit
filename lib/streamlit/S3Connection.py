"""Handles a connecton to an S3 bucket to send Report data."""

import boto3
from boto3.s3.transfer import S3Transfer
import glob
import os
import sys
import urllib

from streamlit import config

# import shutil
# import time
# import hashlib
# import base64
# import time
#
# from google.cloud import storage
# from streamlit.util import get_local_id

#
# def calculate_hash(filename):
#     return '<REMVOE THIS FUNCTION>'
#     binary_hash = hashlib.md5(open(filename,'rb').read()).digest()
#     return base64.b64encode(binary_hash).decode("utf-8")
#
#
# def upload_blobs(blobs):
#     for filename, blob in blobs.items():
#         blob.upload_from_filename(filename)
#         blob.make_public()
#         print(filename)
#
# def upload_s3(s3, files):
#     for filename, location in files.items():
#         s3.put_object(Body=open(filename,'rb').read(), Bucket='streamlit-test9', Key=location, ACL='public-read')
#         print(filename)

class S3Connection:
    """Handles a connecton to an S3 bucket to send Report data."""

    def __init__(self):
        # # #self._uuid_user = uuid_user()
        # # # self._client = storage.Client()
        # # # self._bucketname = 'streamlit-gcs-test'
        # # self._local_id = str(get_local_id())
        # # self._ts = str(time.time())
        # #
        # # # if not self._client.lookup_bucket(self._bucketname):
        # # #     self._client.create_bucket(self._bucketname)
        # # #     self._bucket.configure_website('index.html')
        # # #     self._bucket.make_public(recursive=True, future=True)
        # #
        # # # self._bucket = self._client.get_bucket(self._bucketname)
        #
        # # dirname = os.path.dirname(os.path.normpath(__file__))
        # # basedir = dirname  # os.path.normpath(os.path.join(dirname, '..'))
        # # static_root = os.path.join(basedir, 'static')
        # # print('static_root', static_root)
        # # print('staticRoot', )
        # # sys.exit(-1)
        #
        # self._has_static_files = False
        #
        # if not self._has_static_files:
        #     static_root = config.get_path('proxy.staticRoot')
        #     dirs = []
        #     filenames = []
        #     for filename in glob.iglob(os.path.join(static_root, '**'), recursive=True):
        #         if os.path.isfile(filename):
        #             filenames.append(os.path.relpath(filename, static_root))
        #         if os.path.isdir(filename):
        #             dirs.append(os.path.relpath(filename, static_root))
        #
        # if not filenames:
        #     print("No static files in {}".format(static_root))
        #     sys.exit(1)
        # #
        # # # blobs = {x.name: x.md5_hash for x in self._bucket.list_blobs()}
        # files = {x: calculate_hash(os.path.join(static_root, x)) for x in filenames}
        # # #
        # upload = files.keys()
        # # # upload = [x for x in set(files.keys()) - set(blobs.keys())]
        # # # common = [x for x in set(blobs.keys()) & set(files.keys())]
        # # # for f in common:
        # # #     filename = os.path.join(static_root, f)
        # # #     hash = files[f]
        # # #     upload_hash = blobs[f]
        # # #     if hash != upload_hash:
        # # #         upload.append(f)
        # # #
        # # # blobs = {}
        # # # for f in upload:
        # # #     blob = self._bucket.blob(os.path.join(self._local_id, self._ts, f))
        # # #     filename = os.path.join(static_root, f)
        # # #     blobs[filename] = blob
        # # # self._blobs = blobs
        # #
        # self._stuffs = {}
        # for f in upload:
        #     path  = os.path.join(f)
        #     filename = os.path.join(static_root, f)
        #     self._stuffs[filename] = path
        # print('THESE ARE THE STUFFS:')
        # for k, v in self._stuffs.items():
        #     print('-', k, v)
        # sys.exit(-1)
        self._s3 = boto3.client('s3')
        self._bucket = 'streamlit-test10'
        self._transfer = S3Transfer(self._s3)

#        upload_blobs(blobs)
    # def upload_static(self):
    #     #upload_blobs(self._blobs)
    #     upload_s3(self._s3, self._stuffs)

    # def local_save(self, data):
    #         filename = os.path.join(self._session_dir, str(time.time()) + '.data')
    #         print(filename)
    #
    #         with open(filename, 'wb') as f:
    #             f.write(data)
    #
    #         print('Wrote {}'.format(filename))

    def upload_report(self, report_name, report_id, serialized_deltas):
        """Saves this report to our s3 bucket."""
        # Function to store data in the s3 bucket
        def put_object(data, location):
            self._s3.put_object(Body=data, Bucket=self._bucket,
                Key=location, ACL='public-read')

        # All files in this bundle will be saved in this path.
        save_root = os.path.join(
            config.get_option('cloud.staticSaveRoot'),
            urllib.parse.quote_plus(report_name),
            report_id)

        # Save all the files in the static directory (excluding map files.)
        static_root = config.get_path('proxy.staticRoot')
        all_files = glob.iglob(os.path.join(static_root, '**'), recursive=True)
        for load_filename in all_files:
            if not os.path.isfile(load_filename):
                continue
            if load_filename.endswith('.map'):
                continue
            relative_filename = os.path.relpath(load_filename, static_root)
            save_filename = os.path.join(save_root, relative_filename)
            with open(load_filename, 'rb') as input:
                put_object(input.read(), save_filename)
                print(load_filename, '->', save_filename)
        print('Finished saving.')

        print('upload_report', report_name, report_id, type(serialized_deltas))
        print('save to', save_root)
        sys.exit(-1)

        # location = os.path.join(self._local_id, self._ts, 'data.pb')
        #
        # path = os.path.join(self._local_id, self._ts, 'index.html')
        # print("https://s3-us-west-2.amazonaws.com/streamlit-test9/" + path)

    def _upload_file(self, load_filename, save_filename):
        pass
