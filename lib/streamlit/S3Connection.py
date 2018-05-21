"""Handles a connecton to an S3 bucket to send Report data."""

# from boto3.s3.transfer import S3Transfer
import aiobotocore
import glob
import hashlib
import mimetypes
import os
import sys

import streamlit
from streamlit import config

# <bucket>/streamlit_static/<release hash>/... static content here.
# <bucket>/streamlit_static/<release hash>/reports/<report_id>.protobuf

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


        # THIS IS THE GOOD STUFF
        # self._s3 = boto3.client('s3')
        self._bucket = 'streamlit-test10'
        # self._transfer = S3Transfer(self._s3)
        # pass

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

    async def upload_report(self, report_id, serialized_deltas):
        """Saves this report to our s3 bucket."""
        print('Got into upload_report (ASYNC DEF VERSION!)')

        # Get the static files which need to be saved and their release hash.
        static_root = config.get_path('proxy.staticRoot')
        all_files = glob.iglob(os.path.join(static_root, '**'), recursive=True)
        static_data = []
        md5 = hashlib.md5()
        found_index = False
        for filename in sorted(all_files):
            if os.path.isfile(filename):
                relative_path = os.path.relpath(filename, static_root)
                found_index = found_index or filename.endswith('index.html')
                with open(filename, 'rb') as input:
                    file_data = input.read()
                    static_data.append((relative_path, file_data))
                    md5.update(file_data)
        assert found_index, "Cannot find static files. Run 'make build'."
        release_hash = f'{streamlit.__version__}-{md5.digest().hex()}'

        # This gives us the filename of a thing
        def s3_key(relative_path):
            cloud_root = config.get_option('cloud.staticSaveRoot')
            return os.path.join(cloud_root, release_hash, relative_path)

        # Start the session:
        session = aiobotocore.get_session()
        async with session.create_client('s3') as client:
            # Figure out whether we need to save the static data.
            index_key = s3_key('index.html')
            found_index = False
            response = await client.list_objects_v2(Bucket=self._bucket, Prefix=index_key)
            for obj in response.get('Contents', []):
                if obj['Key'] == index_key:
                    found_index = True
                    break
            print('Found the index:', found_index)

            # Figure out what we need to save
            save_data = [(f'reports/{report_id}.protobuf', serialized_deltas)]
            if not found_index:
                print('Didnt find the index. Adding many files.')
                save_data.extend(static_data)
            else:
                print('Found the index, skipping many files')

            # Save all the data
            for path, data in save_data:
                mime_type = mimetypes.guess_type(path)[0]
                if not mime_type:
                    mime_type = 'application/octet-stream'
                await client.put_object(Bucket=self._bucket, Body=data,
                    Key=s3_key(path), ContentType=mime_type, ACL='public-read')
                print(path, '->', s3_key(path))

        # all_data = [(
        #         ,
        #         open(filename, 'rb').read()
        #     ) for filename in sorted(all_files) if ]
        #
        # # Compute the release hash for these static files.
        # md5 = hashlib.md5()
        # m.update

        # # Function to store data in the s3 bucket
        # def put_object(data, location):
        #     self._s3.put_object(Body=data, Bucket=self._bucket,
        #         Key=location, ACL='public-read')

        # All files in this bundle will be saved in this path.

        # Save all the files in the static directory (excluding map files.)


            # for load_filename in all_files:
            #     if not os.path.isfile(load_filename):
            #         continue
            #     if load_filename.endswith('.map'):
            #         continue
            #     # relative_filename =
            #     save_filename = os.path.join(save_root, relative_filename)
            #     # self._upload_file(load_filename, save_filename)
            #     # resp = await client.upload_file(load_filename, self._bucket, save_filename)
            #     # def callback(*args, **kwargs):
            #     #     print('CALLBACK', args, kwargs)

            #     print(f'The mime type for "{load_filename}" is "{mime_type}".')
            #     with open(load_filename, 'rb') as input:
            #         data = input.read()
            #
            #         # test to see if the file exists
            #
            # print('ABOUT TO UPLOAD THE DELTAS')
            # delta_filename = os.path.join(save_root, 'deltas.protobuf')
            # try:
            #     await client.put_object(Bucket=self._bucket, Key=delta_filename,
            #         Body=serialized_deltas, ContentType='application/octet-stream',
            #         ACL='public-read')
            # except Exception as e:
            #     print('GOT EXCEPTION', e)
            #
            # print('Finished saving.')
            # print('upload_report done', report_id, type(serialized_deltas))
