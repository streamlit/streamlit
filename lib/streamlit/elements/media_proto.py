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

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from future.types import newbytes
from streamlit.compatibility import setup_2_3_shims

setup_2_3_shims(globals())

import io
import base64
import re

from validators import url

from streamlit.proto import Video_pb2


# Regular expression explained at https://regexr.com/4n2l2 Covers any youtube
# URL (incl. shortlinks and embed links) and extracts its code.
YOUTUBE_RE = re.compile(
    # Protocol
    "http(?:s?):\/\/"
    # Domain
    "(?:www\.)?youtu(?:be\.com|\.be)\/"
    # Path and query string
    "(?P<watch>(watch\?v=)|embed\/)?(?P<code>[\w\-\_]*)(&(amp;)?[\w\?=]*)?"
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


def marshall_video(proto, url, format="video/mp4", start_time=0):
    """Marshalls a video proto, using url processors as needed.

    Parameters
    ----------
    proto : the proto to fill. Must have a string field called "data".
    url : str
        String with a URL pointing to the file to load.
    format : str
        The mime type for the video file. Defaults to 'video/mp4'.
        See https://tools.ietf.org/html/rfc4281 for more info.
    start_time : int
        The time from which this element should start playing. (default: 0)
    """

    proto.format = format
    proto.start_time = start_time
    proto.type = Video_pb2.Video.Type.NATIVE

    youtube_url = _reshape_youtube_url(url)
    if youtube_url:
        proto.url = youtube_url
        proto.type = Video_pb2.Video.Type.YOUTUBE_IFRAME
    else:
        proto.url = url


def marshall_audio(proto, url, format="audio/wav", start_time=0):
    """Marshalls an audio proto, using data and url processors as needed.

    Parameters
    ----------
    proto : The proto to fill. Must have a string field called "url".
    url : str  
        String with a URL pointing to the file to load.
    format : str
        The mime type for the audio file. Defaults to "audio/wav".
        See https://tools.ietf.org/html/rfc4281 for more info.
    start_time : int
        The time from which this element should start playing. (default: 0)
    """

    proto.format = format
    proto.start_time = start_time
    proto.url = url
