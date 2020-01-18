

class File(object):
    """Queue that smartly accumulates the report's messages."""

    def __init__(self, file_id, name, size, last_modified, data):

        self.file_id = file_id
        self.name = name
        self.size = size
        self.last_modified = last_modified
        self.data = data


class MediaFileManager(object):
    def __init__(self):
        self._file_list = {}

    def delete_all_files(self):
        for file_id in list(self._file_list):
            self.delete_file(widget_id)

    def delete_file(self, file_id):
        del self._file_list[file_id]

    def create_or_clear_file(self, file_id, name, size, last_modified, data):
        if file_id in self._file_list:
            self.delete_file(file_id)

        new = File(
            file_id=file_id,
            name=name,
            size=size,
            last_modified=last_modified,
            data=data
        )
        self._file_list[file_id] = new

    def get_data(self, file_id):
        """Get the contents of file stored at file_id."""

        if file_id not in self._file_list:
            return None

        fi = self._file_list[file_id]

        progress = 100

        if fi.data is None:
            progress = float(len(fi.buffers)) / fi.total_chunks
            progress = round(100 * progress)

        return progress, fi.data


