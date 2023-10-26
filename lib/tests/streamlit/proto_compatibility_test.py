# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from streamlit.proto.Common_pb2 import FileURLs, FileURLsRequest, FileURLsResponse


def test_file_urls_request_proto_stable():
    d = FileURLsRequest.DESCRIPTOR
    fd = d.fields[0]

    assert {(f.name, f.label, f.type) for f in d.fields} == {
        ("request_id", fd.LABEL_OPTIONAL, fd.TYPE_STRING),
        ("file_names", fd.LABEL_REPEATED, fd.TYPE_STRING),
        ("session_id", fd.LABEL_OPTIONAL, fd.TYPE_STRING),
    }


def test_file_urls_proto_stable():
    d = FileURLs.DESCRIPTOR
    fd = d.fields[0]

    assert {(f.name, f.label, f.type) for f in d.fields} == {
        ("file_id", fd.LABEL_OPTIONAL, fd.TYPE_STRING),
        ("upload_url", fd.LABEL_OPTIONAL, fd.TYPE_STRING),
        ("delete_url", fd.LABEL_OPTIONAL, fd.TYPE_STRING),
    }


def test_file_urls_response_proto_stable():
    d = FileURLsResponse.DESCRIPTOR
    fd = d.fields[0]

    assert {(f.name, f.label, f.type) for f in d.fields} == {
        ("response_id", fd.LABEL_OPTIONAL, fd.TYPE_STRING),
        ("file_urls", fd.LABEL_REPEATED, fd.TYPE_MESSAGE),
        ("error_msg", fd.LABEL_OPTIONAL, fd.TYPE_STRING),
    }
