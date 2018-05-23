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

class S3Connection:
    """Handles a connecton to an S3 bucket to send Report data."""

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
        # This gives us the filename of a thing
        def s3_key(relative_path):
            cloud_root = config.get_option('cloud.staticSaveRoot')
            return os.path.join(cloud_root, self._release_hash, relative_path)

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
            serialized_report = report.SerializeToString()
            save_data = [(f'reports/{report_id}.protobuf', serialized_report)]
            if not found_index:
                print('Didnt find the index. Adding many files.')
                save_data.extend(self._static_data)
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

        # Return the url for the saved report.
        domain = 's3-us-west-2.amazonaws.com'
        full_path = self._bucket + '/' + s3_key("index.html")
        return f'https://{domain}/{full_path}?id={report_id}'
