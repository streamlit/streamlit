import glob
import os
import shutil
import time

from streamlit import uuid_user

class Cloud:
    def __init__(self):
        self._uuid_user = uuid_user()

        self._tmp_dir = '/tmp/streamlit'

        dirname = os.path.dirname(os.path.normpath(__file__))
        basedir = os.path.normpath(os.path.join(dirname, '..'))
        self._static_dir = os.path.join(basedir, 'static')

        self._has_static_files = False

        if not self._has_static_files:
            if os.path.isfile(os.path.join(self._tmp_dir, 'index.html')):
               return

            # Not using copytree because if i use s3 or gcs i might still have
            # to individually copy files.
            # TODO(armando): Replace with shutil.copytree once in figure
            # things out.
            dirs = []
            files = []
            for filename in glob.iglob(os.path.join(self._static_dir, '**'), recursive=True):
                if os.path.isfile(filename):
                    files.append(os.path.relpath(filename, self._static_dir))
                if os.path.isdir(filename):
                    dirs.append(os.path.relpath(filename, self._static_dir))

            for d in dirs:
                os.makedirs(os.path.join(self._tmp_dir, d))

            for f in files:
                shutil.copy(
                    os.path.join(self._static_dir, f),
                    os.path.join(self._tmp_dir, f))

            self._has_static_files = True

    def create(self, name):
        self._session_dir = os.path.join(self._tmp_dir, 'data', self._uuid_user, name)
        if not os.path.isdir(self._session_dir):
            os.makedirs(self._session_dir)

    def local_save(self, data):
            filename = os.path.join(self._session_dir, str(time.time()) + '.data')
            print(filename)

            with open(filename, 'wb') as f:
                f.write(data)

            print('Wrote {}'.format(filename))
