# -*- coding: utf-8 -*-
# Copyright 2018-2020 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""Provides global MediaFileManager object as `media_file_manager`."""

import hashlib
from datetime import datetime

STATIC_MEDIA_ENDPOINT = "/media"


def _get_file_id(data, mimetype=None):
    """
    Parameters
    ----------

    data : bytes
        Content of media file in bytes. Other types will throw TypeError.
    mimetype : str
        Any string. Will be converted to bytes and used to compute a hash.
        None will be converted to empty string.  [default: None]
    """

    if mimetype is None:
        mimetype = ""

    # Use .update() to prevent making another copy of the data to compute the hash.
    filehash = hashlib.sha224(data)
    filehash.update(bytes(mimetype.encode("utf-8")))
    return filehash.hexdigest()


class MediaFile(object):
    """Abstraction for audiovisual/image file objects."""

    def __init__(self, file_id=None, content=None, mimetype=None):
        self.file_id = file_id
        self.content = content
        self.mimetype = mimetype

    @property
    def url(self):
        return "{}/{}.{}".format(
            STATIC_MEDIA_ENDPOINT, self.file_id, self.mimetype.split("/")[1]
        )


class MediaFileManager(object):
    """In-memory file manager for MediaFile objects."""

    def __init__(self):
        self._files = {}

    def clear(self):
        """Deletes all files from the file manager. """
        self._files.clear()

    def delete(self, mediafile_or_id):
        """Deletes MediaFile via file_id lookup.
        Raises KeyError if not found.
        """
        if type(mediafile_or_id) is MediaFile:
            del self._files[MediaFile.file_id]
        else:
            del self._files[mediafile_or_id]

    def add(self, content, mimetype):
        """Adds new MediaFile with given parameters; returns the object.

        If an identical file already exists, returns the existing object
        rather than creating a new one.

        mimetype must be set, as this string will be used in the
        "Content-Type" header when the file is sent via HTTP GET.

        Parameters
        ----------
        content : bytes
            Raw data to store in file object.
        mimetype : str
            The mime type for the media file. E.g. "audio/mpeg"
        """
        file_id = _get_file_id(content, mimetype)

        if not file_id in self._files:
            new = MediaFile(file_id=file_id, content=content, mimetype=mimetype,)
            self._files[file_id] = new
        return self._files[file_id]

    def get(self, mediafile_or_id):
        """Returns MediaFile object for given file_id.
        Raises KeyError if not found.
        """
        if type(mediafile_or_id) is MediaFile:
            return mediafile_or_id
        return self._files[mediafile_or_id]

    def __contains__(self, mediafile_or_id):
        if type(mediafile_or_id) is MediaFile:
            return mediafile_or_id.file_id in self._files
        return mediafile_or_id in self._files

    def __len__(self):
        return len(self._files)


media_file_manager = MediaFileManager()
