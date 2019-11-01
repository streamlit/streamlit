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

from streamlit.logger import get_logger
from streamlit import config
from uuid import uuid1
import os

LOGGER = get_logger(__name__)


class File(object):
    def __init__(self, widget_id, name, size, last_modified, chunks):

        folder = config.get_option("server.temporaryFileUploadFolder")
        if not os.path.exists(folder):
            try:
                os.makedirs(folder)
            except OSError as e:
                if e.errno != errno.EEXIST:
                    raise

        self.widget_id = widget_id
        self.name = name
        self.full_name = folder + "/" + uuid1().hex
        self.size = size
        self.last_modified = last_modified
        self.total_chunks = chunks
        self.received_chunks = 0
        self.buffers = {}


class FileManager(object):
    def __init__(self):
        self._file_list = {}

    def delete_all_files(self):
        for widget_id in list(self._file_list):
            self.delete_file(widget_id)

    def delete_file(self, widget_id):
        os.remove(self._file_list[widget_id].full_name)
        del self._file_list[widget_id]

    def locate_new_file(self, widget_id, name, size, last_modified, chunks):

        file = self._file_list.get(widget_id)
        if file != None:
            self.delete_file(widget_id)

        file = File(
            widget_id=widget_id,
            name=name,
            size=size,
            last_modified=last_modified,
            chunks=chunks,
        )
        self._file_list[widget_id] = file

    def check_file(self, widget_id):
        return self._file_list[widget_id]

    def porcess_chunk(self, widget_id, index, data):
        file = self._file_list.get(widget_id)
        if file != None:
            file.buffers[index] = data
            file.received_chunks = file.received_chunks + 1

            if file.received_chunks == file.total_chunks:
                f = open(file.full_name, "wb")
                index = 0
                while file.buffers.get(index) != None:
                    f.write(file.buffers[index])
                    del file.buffers[index]
                    index = index + 1

                f.close()
                file.buffers = None
                return 1, file.full_name

        progress = 0 
        if file.received_chunks > 0:
            progress = file.received_chunks/file.total_chunks

        return progress, file.full_name
