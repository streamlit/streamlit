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

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from future.types import newbytes
from streamlit.compatibility import setup_2_3_shims

setup_2_3_shims(globals())

import io
import base64
import re
import mimetypes

from validators import url

from streamlit.proto import Video_pb2
from streamlit.MediaFileManager import mfm as _media_filemanager


# Regular expression explained at https://regexr.com/4n2l2 Covers any youtube
# URL (incl. shortlinks and embed links) and extracts its code.
YOUTUBE_RE = re.compile(
    # Protocol
    r"http(?:s?):\/\/"
    # Domain
    r"(?:www\.)?youtu(?:be\.com|\.be)\/"
    # Path and query string
    r"(?P<watch>(watch\?v=)|embed\/)?(?P<code>[\w\-\_]*)(&(amp;)?[\w\?=]*)?"
)


def _reshape_youtube_url(url):
    """Return whether URL is any kind of YouTube embed or watch link.  If so,
    reshape URL into an embed link suitable for use in an iframe.

    If not a YouTube URL, return None.

    Parameters
    ----------
        url : str or bytes

    Example
    -------
    >>> print(_reshape_youtube_url('https://youtu.be/_T8LGqJtuGc'))

    .. output::
        https://www.youtube.com/embed/_T8LGqJtuGc
    """
    match = YOUTUBE_RE.match(url)
    if match:
        return "https://www.youtube.com/embed/{code}".format(**match.groupdict())
    return None


def _marshall_binary(proto, data):
    """ Handles binary data and packs the proto.url field with a link to 
    this media file stored in a file manager.
    """

    if not data:
        # allow None values so media players can be shown without media.
        proto.url = ""
        proto.format = ""       # TODO: remove?
        return

    elif isinstance(data, bytes):
        pass

    elif isinstance(data, io.BytesIO):
        data.seek(0)
        data = date.getvalue()
    elif isinstance(data, io.IOBase):
        data.seek(0)
        data = data.read()
    # elif type(data).__name__ == "ndarray":
    #    data = ...
    else:
        raise RuntimeError("Invalid binary data format: %s" % type(data))

    this_file = _media_filemanager.add(data, mimetype=proto.format)
    proto.url = this_file.url


def _marshall_av_media(proto, data):
    """ Assume format has already been set in the proto.  Here we make decisions about 
    whether the contents of the data refer to a filename, or a series of bytes.
    """

    if isinstance(data, string_types):
        # Assume it's a filename or blank.  Allow OS-based file errors.
        with open(data, "rb") as fh:
            new = _media_filemanager.add(fh.read(), filename=data, mimetype=format)
            proto.url = new.url
        #except Exception as err:
        #    if type(data) is bytes:
        #        # we're here because Python2 treats str and bytes equivalently.
        #         _marshall_binary(proto, data)
        #    else:
        #        raise FileNotFoundError("File not found: %s" % data)

    else:
        _marshall_binary(proto, data)


def marshall_video(proto, data, mimetype="video/mp4", start_time=0):
    """Marshalls a video proto, using url processors as needed.

    Parameters
    ----------
    proto : the proto to fill. Must have a string field called "data".
    data : str, bytes, BytesIO, numpy.ndarray, or file opened with
           io.open().
        Raw video data or a string with a URL pointing to the video
        to load. Includes support for YouTube URLs.
        If passing the raw data, this must include headers and any other
        bytes required in the actual file.
    mimetype : str
        The mime type for the video file. Defaults to 'video/mp4'.
        See https://tools.ietf.org/html/rfc4281 for more info.
    start_time : int
        The time from which this element should start playing. (default: 0)
    """

    proto.format = mimetype     #TODO: do we need this anymore?
    proto.start_time = start_time

    # "type" distinguishes between YouTube and non-YouTube links
    proto.type = Video_pb2.Video.Type.NATIVE

    if isinstance(data, string_types) and url(data):  # noqa: F821
        youtube_url = _reshape_youtube_url(data)
        if youtube_url:
            proto.url = youtube_url
            proto.type = Video_pb2.Video.Type.YOUTUBE_IFRAME
        else:
            proto.url = data
    
    else:
        _marshall_av_media(proto, data)


def marshall_audio(proto, data, mimetype="audio/wav", start_time=0):
    """Marshalls an audio proto, using data and url processors as needed.

    Parameters
    ----------
    proto : The proto to fill. Must have a string field called "url".
    data : str, bytes, BytesIO, numpy.ndarray, or file opened with
            io.open()
        Raw audio data or a string with a URL pointing to the file to load.
        If passing the raw data, this must include headers and any other bytes
        required in the actual file.
    mimetype : str
        The mime type for the audio file. Defaults to "audio/wav".
        See https://tools.ietf.org/html/rfc4281 for more info.
    start_time : int
        The time from which this element should start playing. (default: 0)
    """

    proto.format = mimetype     #TODO: do we need this anymore?
    proto.start_time = start_time

    if isinstance(data, string_types):
        if url(data):  # noqa: F821
            proto.url = data

    else:
        _marshall_av_media(proto, data)

