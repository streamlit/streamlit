"""Provides global media file manager object as `mfm`."""

import hashlib
from datetime import datetime

STATIC_MEDIA_ENDPOINT = "/media"


def _get_file_id(data, mimetype):
    if mimetype is None:
        mimetype = ""
    return hashlib.sha224(bytes(mimetype) + data).hexdigest()


class MediaFile(object):
    """Abstraction for audiovisual/image file objects."""

    def __init__(
        self,
        file_id=None,
        content=None,
        mimetype=None,
        filename=None,
        size=None,
        last_modified=None,
    ):

        self.file_id = file_id
        self.content = content
        self.mimetype = mimetype
        self.filename = filename
        self.size = size
        self.last_modified = last_modified

    @property
    def url(self):
        if self.mimetype:
            return "{}/{}.{}".format(
                STATIC_MEDIA_ENDPOINT, self.file_id, self.mimetype.split("/")[1]
            )
        return "{}/{}".format(STATIC_MEDIA_ENDPOINT, self.file_id)


class MediaFileManager(object):
    """In-memory file manager for MediaFile objects."""

    def __init__(self):
        self._files = {}

    def clear(self):
        """ Deletes all files from the file manager. """
        for file_id in list(self._files):
            self.delete(widget_id)

    def delete(self, file_id):
        """ Deletes file with specified file_id. """
        del self._files[file_id]

    def add(self, content, mimetype=None, filename=None):
        """ Adds new file with given content. Creates a hash of the 
        data to make a file ID.  If a file with given ID already exists,
        returns the MediaFile object.  Otherwise, creates a new file 
        with given content and supplied parameters.

        mimetype should be set for best results.  filename can be elided.

        Parameters
        ----------
        content : str, bytes.  Raw data to store in file object.
        mimetype : str
            The mime type for the media file. E.g. "audio/mpeg"
        filename : str
            User-defined filename of loaded file. (Default: None)
        """
        file_id = _get_file_id(content, mimetype)

        if not file_id in self._files:
            new = MediaFile(
                file_id=file_id,
                content=content,
                mimetype=mimetype,
                filename=filename,
                last_modified=datetime.utcnow(),
            )
            self._files[file_id] = new
        return self._files[file_id]

    def get(self, file_id):
        """ Returns MediaFile object for given file_id.  
        Raises KeyError if not found.
        """
        return self._files[file_id]

    def __contains__(self, file_id):
        return file_id in self._files


mfm = MediaFileManager()
