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

from streamlit import type_util

import io
import re

from validators import url

from streamlit import type_util
from streamlit.proto.Audio_pb2 import Audio as AudioProto
from streamlit.proto.Video_pb2 import Video as VideoProto
from streamlit.media_file_manager import media_file_manager


class MediaMixin:
    def audio(dg, data, format="audio/wav", start_time=0):
        """Display an audio player.

        Parameters
        ----------
        data : str, bytes, BytesIO, numpy.ndarray, or file opened with
                io.open().
            Raw audio data, filename, or a URL pointing to the file to load.
            Numpy arrays and raw data formats must include all necessary file
            headers to match specified file format.
        start_time: int
            The time from which this element should start playing.
        format : str
            The mime type for the audio file. Defaults to 'audio/wav'.
            See https://tools.ietf.org/html/rfc4281 for more info.

        Example
        -------
        >>> audio_file = open('myaudio.ogg', 'rb')
        >>> audio_bytes = audio_file.read()
        >>>
        >>> st.audio(audio_bytes, format='audio/ogg')

        .. output::
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=Dv3M9sA7Cg8gwusgnVNTHb
           height: 400px

        """
        audio_proto = AudioProto()
        coordinates = dg._get_coordinates()  # type: ignore
        marshall_audio(coordinates, audio_proto, data, format, start_time)
        return dg._enqueue("audio", audio_proto)  # type: ignore

    def video(dg, data, format="video/mp4", start_time=0):
        """Display a video player.

        Parameters
        ----------
        data : str, bytes, BytesIO, numpy.ndarray, or file opened with
                io.open().
            Raw video data, filename, or URL pointing to a video to load.
            Includes support for YouTube URLs.
            Numpy arrays and raw data formats must include all necessary file
            headers to match specified file format.
        format : str
            The mime type for the video file. Defaults to 'video/mp4'.
            See https://tools.ietf.org/html/rfc4281 for more info.
        start_time: int
            The time from which this element should start playing.

        Example
        -------
        >>> video_file = open('myvideo.mp4', 'rb')
        >>> video_bytes = video_file.read()
        >>>
        >>> st.video(video_bytes)

        .. output::
           https://static.streamlit.io/0.66.0-2BLtg/index.html?id=DzAouvizGRAyuLjkPpR894
           height: 600px

        .. note::
           Some videos may not display if they are encoded using MP4V (which is an export option in OpenCV), as this codec is
           not widely supported by browsers. Converting your video to H.264 will allow the video to be displayed in Streamlit.
           See this `StackOverflow post <https://stackoverflow.com/a/49535220/2394542>`_ or this
           `Streamlit forum post <https://discuss.streamlit.io/t/st-video-doesnt-show-opencv-generated-mp4/3193/2>`_
           for more information.

        """
        video_proto = VideoProto()
        coordinates = dg._get_coordinates()  # type: ignore
        marshall_video(coordinates, video_proto, data, format, start_time)
        return dg._enqueue("video", video_proto)  # type: ignore


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


def _marshall_av_media(coordinates, proto, data, mimetype):
    """Fill audio or video proto based on contents of data.

    Given a string, check if it's a url; if so, send it out without modification.
    Otherwise assume strings are filenames and let any OS errors raise.

    Load data either from file or through bytes-processing methods into a
    MediaFile object.  Pack proto with generated Tornado-based URL.
    """
    # Audio and Video methods have already checked if this is a URL by this point.

    if isinstance(data, str):
        # Assume it's a filename or blank.  Allow OS-based file errors.
        with open(data, "rb") as fh:
            this_file = media_file_manager.add(fh.read(), mimetype, coordinates)
            proto.url = this_file.url
            return

    if data is None:
        # Allow empty values so media players can be shown without media.
        return

    # Assume bytes; try methods until we run out.
    if isinstance(data, bytes):
        pass
    elif isinstance(data, io.BytesIO):
        data.seek(0)
        data = data.getvalue()
    elif isinstance(data, io.RawIOBase) or isinstance(data, io.BufferedReader):
        data.seek(0)
        data = data.read()
    elif type_util.is_type(data, "numpy.ndarray"):
        data = data.tobytes()
    else:
        raise RuntimeError("Invalid binary data format: %s" % type(data))

    this_file = media_file_manager.add(data, mimetype, coordinates)
    proto.url = this_file.url


def marshall_video(coordinates, proto, data, mimetype="video/mp4", start_time=0):
    """Marshalls a video proto, using url processors as needed.

    Parameters
    ----------
    coordinates : str
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

    proto.start_time = start_time

    # "type" distinguishes between YouTube and non-YouTube links
    proto.type = VideoProto.Type.NATIVE

    if isinstance(data, str) and url(data):
        youtube_url = _reshape_youtube_url(data)
        if youtube_url:
            proto.url = youtube_url
            proto.type = VideoProto.Type.YOUTUBE_IFRAME
        else:
            proto.url = data

    else:
        _marshall_av_media(coordinates, proto, data, mimetype)


def marshall_audio(coordinates, proto, data, mimetype="audio/wav", start_time=0):
    """Marshalls an audio proto, using data and url processors as needed.

    Parameters
    ----------
    coordinates : str
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

    proto.start_time = start_time

    if isinstance(data, str) and url(data):
        proto.url = data

    else:
        _marshall_av_media(coordinates, proto, data, mimetype)
