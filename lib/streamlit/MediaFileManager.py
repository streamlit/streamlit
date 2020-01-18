

class File(object):
    """Queue that smartly accumulates the report's messages."""

    def __init__(self, file_id=None, data=None, name=None, size=None, last_modified=None):

        self.file_id = file_id
        self.name = name
        self.size = size
        self.last_modified = last_modified
        self.data = data

    @property
    def url(self):
        return str(self.file_id)


class MediaFileManager(object):
    def __init__(self):
        self._file_list = {}

    def delete_all_files(self):
        for file_id in list(self._file_list):
            self.delete_file(widget_id)

    def delete_file(self, file_id):
        del self._file_list[file_id]

    def add(self, data, file_id=None, name=None):
        if not file_id:
            file_id = hash(data)

        if not file_id in self._file_list:
            new = File(
                file_id=file_id,
                data=data,
                name=name,
            )
            self._file_list[file_id] = new
        return self._file_list[file_id]

    def get_data(self, file_id):
        """Get the contents of file stored at file_id."""

        fi = self._file_list[file_id]
        return fi.data

    def __contains__(self, file_id):
        return file_id in self._file_list


