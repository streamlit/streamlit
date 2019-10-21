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
    def __init__(self, widgetId, name, size, lastModified, chunks):

        folder = config.get_option("server.temporaryFileUploadFolder")
        if not os.path.exists(folder):
            try:
                os.makedirs(folder)
            except OSError as e:
                if e.errno != errno.EEXIST:
                    raise

        self.widgetId = widgetId
        self.name = name
        self.fullName = folder + "/" + uuid1().hex
        self.size = size
        self.lastModified = lastModified
        self.totalChunks = chunks
        self.missingChunks = chunks
        self.buffers = {}


class FileManager(object):
    def __init__(self):
        self.fileList = {}

    def delete_all_files(self):
        for widgetId in self.fileList:
            self.delete_file(widgetId)

    def delete_file(self, widgetId):
        os.remove(self.fileList[widgetId].fullName)
        self.fileList[widgetId] = None

    def locate_new_file(self, widgetId, name, size, lastModified, chunks):

        file = self.fileList.get(widgetId)
        if file != None:
            self.delete_file(widgetId)

        file = File(
            widgetId=widgetId,
            name=name,
            size=size,
            lastModified=lastModified,
            chunks=chunks,
        )
        self.fileList[widgetId] = file

    def porcess_chunk(self, widgetId, index, data):
        file = self.fileList.get(widgetId)
        if file != None:
            file.buffers[index] = data
            file.missingChunks = file.missingChunks - 1

            if file.missingChunks == 0:
                f = open(file.fullName, "wb")
                index = 0
                while file.buffers.get(index) != None:
                    f.write(file.buffers[index])
                    file.buffers[index] = None
                    index = index + 1

                f.close()
                file.buffers = None
                return 1, file.fullName

        return (file.totalChunks / file.missingChunks), file.fullName
