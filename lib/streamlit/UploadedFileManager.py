# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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


class File(object):
    """Queue that smartly accumulates the report's messages."""

    def __init__(self, widget_id, name, size, last_modified, chunks):

        self.widget_id = widget_id
        self.name = name
        self.size = size
        self.last_modified = last_modified
        self.total_chunks = chunks
        self.buffers = {}
        self.data = None

    def process_chunk(self, index, data):
        """Process an incoming file chunk and return percent done."""

        if index in self.buffers:
            raise RuntimeError("File chunk was already processed")

        self.buffers[index] = data
        if len(self.buffers) == self.total_chunks:
            self._coalesce_chunks()
            return 1

        if len(self.buffers) > 0:
            return float(len(self.buffers)) / self.total_chunks

    def _coalesce_chunks(self):
        self.data = bytearray()
        index = 0
        while self.buffers.get(index) != None:
            self.data.extend(self.buffers[index])
            del self.buffers[index]
            index += 1

        self.buffers = {}


class UploadedFileManager(object):
    def __init__(self):
        self._file_list = {}

    def delete_all_files(self):
        for widget_id in list(self._file_list):
            self.delete_file(widget_id)

    def delete_file(self, widget_id):
        del self._file_list[widget_id]

    def create_or_clear_file(self, widget_id, name, size, last_modified, chunks):
        if widget_id in self._file_list:
            self.delete_file(widget_id)

        file = File(
            widget_id=widget_id,
            name=name,
            size=size,
            last_modified=last_modified,
            chunks=chunks,
        )
        self._file_list[widget_id] = file

    def process_chunk(self, widget_id, index, data):
        """Process an incoming file chunk and return percent done."""

        if widget_id not in self._file_list:
            # Handle possible race condition when you cancel an upload
            # and an old file chunk is received.
            return 0

        return self._file_list[widget_id].process_chunk(index, data)

    def get_data(self, widget_id):
        """Get a tuple with file progress and data bytes (or None)."""

        if widget_id not in self._file_list:
            return 0, None

        file = self._file_list[widget_id]

        progress = 100

        if file.data is None:
            progress = float(len(file.buffers)) / file.total_chunks
            progress = round(100 * progress)

        return progress, file.data
