"""Provides global media file manager object as `mfm`."""

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
    return hashlib.sha224(bytes(mimetype.encode("utf-8")) + data).hexdigest()


class MediaFile(object):
    """Abstraction for audiovisual/image file objects."""

    def __init__(
        self, file_id=None, content=None, mimetype=None, size=None, last_modified=None,
    ):

        self.file_id = file_id
        self.content = content
        self.mimetype = mimetype
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
        self._files.clear()

    def delete(self, file_id):
        """ Deletes file with specified file_id. """
        try:
            del self._files[file_id]
        except KeyError:
            raise FileNotFoundError(
                "File_id %s not found in MediaFileManager." % file_id
            )

    def add(self, content, mimetype=None):
        """ Adds new file with given content. Creates a hash of the 
        data to make a file ID.  If a file with given ID already exists,
        returns the MediaFile object.  Otherwise, creates a new file 
        with given content and supplied parameters.

        mimetype should be set for best results, as its contents will be
        used in the "Content-Type" header when the file is sent via HTTP
        in response to the front-end's GET request.

        Parameters
        ----------
        content : str, bytes.  Raw data to store in file object.
        mimetype : str
            The mime type for the media file. E.g. "audio/mpeg"
            (Default: None)
        """
        file_id = _get_file_id(content, mimetype)

        if not file_id in self._files:
            new = MediaFile(
                file_id=file_id,
                content=content,
                mimetype=mimetype,
                last_modified=datetime.utcnow(),
            )
            self._files[file_id] = new
        return self._files[file_id]

    def get(self, file_id):
        """ Returns MediaFile object for given file_id.  
        Raises KeyError if not found.
        """
        return self._files[file_id]

    def __contains__(self, file_id_or_mediafile):
        if type(file_id_or_mediafile) is MediaFile:
            return file_id_or_mediafile.file_id in self._files
        return file_id_or_mediafile in self._files

    def __len__(self):
        return len(self._files)


mfm = MediaFileManager()
