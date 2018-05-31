import glob
import os
import shutil
import sys
import time
import hashlib
import base64
import time

from google.cloud import storage
from streamlit.util import get_local_id

import boto3

def calculate_hash(filename):
    binary_hash = hashlib.md5(open(filename,'rb').read()).digest()
    return base64.b64encode(binary_hash).decode("utf-8")


def upload_blobs(blobs):
    for filename, blob in blobs.items():
        blob.upload_from_filename(filename)
        blob.make_public()
        print(filename)

def upload_s3(s3, files):
    for filename, location in files.items():
        s3.put_object(Body=open(filename,'rb').read(), Bucket='streamlit-test9', Key=location, ACL='public-read')
        print(filename)

class Cloud:
    def __init__(self):
        #self._uuid_user = uuid_user()
        # self._client = storage.Client()
        # self._bucketname = 'streamlit-gcs-test'
        self._local_id = str(get_local_id())
        self._ts = str(time.time())

        # if not self._client.lookup_bucket(self._bucketname):
        #     self._client.create_bucket(self._bucketname)
        #     self._bucket.configure_website('index.html')
        #     self._bucket.make_public(recursive=True, future=True)

        # self._bucket = self._client.get_bucket(self._bucketname)

        dirname = os.path.dirname(os.path.normpath(__file__))
        basedir = os.path.normpath(os.path.join(dirname, '..'))
        self._static_dir = os.path.join(basedir, 'static')

        self._has_static_files = False

        if not self._has_static_files:
            dirs = []
            filenames = []
            for filename in glob.iglob(os.path.join(self._static_dir, '**'), recursive=True):
                if os.path.isfile(filename):
                    filenames.append(os.path.relpath(filename, self._static_dir))
                if os.path.isdir(filename):
                    dirs.append(os.path.relpath(filename, self._static_dir))

            self._has_static_files = True

        if not filenames:
            print("No static files in {}".format(self._static_dir))
            sys.exit(1)

        # blobs = {x.name: x.md5_hash for x in self._bucket.list_blobs()}
        files = {x: calculate_hash(os.path.join(self._static_dir, x)) for x in filenames}
        #
        upload = files.keys()
        # upload = [x for x in set(files.keys()) - set(blobs.keys())]
        # common = [x for x in set(blobs.keys()) & set(files.keys())]
        # for f in common:
        #     filename = os.path.join(self._static_dir, f)
        #     hash = files[f]
        #     upload_hash = blobs[f]
        #     if hash != upload_hash:
        #         upload.append(f)
        #
        # blobs = {}
        # for f in upload:
        #     blob = self._bucket.blob(os.path.join(self._local_id, self._ts, f))
        #     filename = os.path.join(self._static_dir, f)
        #     blobs[filename] = blob
        # self._blobs = blobs

        stuffs = {}
        for f in upload:
            path  = os.path.join(self._local_id, self._ts, f)
            filename = os.path.join(self._static_dir, f)
            stuffs[filename] = path
        self._stuffs = stuffs
        self._s3 = boto3.client('s3')

#        upload_blobs(blobs)
    def upload_static(self):
        #upload_blobs(self._blobs)
        upload_s3(self._s3, self._stuffs)

    def local_save(self, data):
            filename = os.path.join(self._session_dir, str(time.time()) + '.data')
            print(filename)

            with open(filename, 'wb') as f:
                f.write(data)

            print('Wrote {}'.format(filename))

    def cloud_save(self, data):
            location = os.path.join(self._local_id, self._ts, 'data.pb')
            self._s3.put_object(Body=data, Bucket='streamlit-test9', Key=location, ACL='public-read')
            path = os.path.join(self._local_id, self._ts, 'index.html')
            print("https://s3-us-west-2.amazonaws.com/streamlit-test9/" + path)
