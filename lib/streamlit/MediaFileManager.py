"""Provides global media file manager object as `mfm`."""

import hashlib
from datetime import datetime


class MediaFile(object):
    """Abstraction for audiovisual/image file objects."""

    def __init__(
        self,
        file_id=None,
        content=None,
        filetype="audio/wav",
        filename=None,
        size=None,
        last_modified=None,
    ):

        self.file_id = file_id
        self.content = content
        self.filetype = filetype
        self.filename = filename
        self.size = size
        self.last_modified = last_modified

    @property
    def url(self):
        return "/media/{}".format(self.file_id)


class MediaFileManager(object):
    """In-memory file manager for MediaFile objects."""

    def __init__(self):
        self._file_list = {}

    def clear(self):
        """ Deletes all files from the file manager. """
        for file_id in list(self._file_list):
            self.delete(widget_id)

    def delete(self, file_id):
        """ Deletes file with specified file_id. """
        del self._file_list[file_id]

    def add(self, content, filetype=None, filename=None):
        """ Adds new file with given content. Creates a hash of the 
        data to make a file ID.  If a file with given ID already exists,
        returns the MediaFile object.  Otherwise, creates a new file 
        with given content and supplied parameters.

        filetype should be set for best results.  filename can be elided.

        Parameters
        ----------
        content : str, bytes.  Raw data to store in file object.
        filetype : str
            The mime type for the media file. E.g. "audio/mpeg"
        filename : str
            User-defined filename of loaded file. (Default: None)
        """
        file_id = hashlib.sha224(content).hexdigest()

        if not file_id in self._file_list:
            new = MediaFile(
                file_id=file_id,
                content=content,
                filetype=filetype,
                filename=filename,
                last_modified=datetime.utcnow(),
            )
            self._file_list[file_id] = new
        return self._file_list[file_id]

    def __contains__(self, file_id):
        return file_id in self._file_list


mfm = MediaFileManager()
