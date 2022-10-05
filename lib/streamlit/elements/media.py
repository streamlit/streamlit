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

import io
import re
from typing import TYPE_CHECKING, Optional, Union, cast

from typing_extensions import Final, TypeAlias
from validators import url

from streamlit import runtime, type_util
from streamlit.proto.Audio_pb2 import Audio as AudioProto
from streamlit.proto.Video_pb2 import Video as VideoProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from typing import Any

    from numpy import typing as npt

    from streamlit.delta_generator import DeltaGenerator


MediaData: TypeAlias = Union[
    str, bytes, io.BytesIO, io.RawIOBase, io.BufferedReader, "npt.NDArray[Any]", None
]


class MediaMixin:
    @gather_metrics
    def audio(
        self,
        data: MediaData,
        format: str = "audio/wav",
        start_time: int = 0,
    ) -> "DeltaGenerator":
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
           https://doc-audio.streamlitapp.com/
           height: 465px

        """
        audio_proto = AudioProto()
        coordinates = self.dg._get_delta_path_str()
        marshall_audio(coordinates, audio_proto, data, format, start_time)
        return self.dg._enqueue("audio", audio_proto)

    @gather_metrics
    def video(
        self,
        data: MediaData,
        format: str = "video/mp4",
        start_time: int = 0,
    ) -> "DeltaGenerator":
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
           https://doc-video.streamlitapp.com/
           height: 700px

        .. note::
           Some videos may not display if they are encoded using MP4V (which is an export option in OpenCV), as this codec is
           not widely supported by browsers. Converting your video to H.264 will allow the video to be displayed in Streamlit.
           See this `StackOverflow post <https://stackoverflow.com/a/49535220/2394542>`_ or this
           `Streamlit forum post <https://discuss.streamlit.io/t/st-video-doesnt-show-opencv-generated-mp4/3193/2>`_
           for more information.

        """
        video_proto = VideoProto()
        coordinates = self.dg._get_delta_path_str()
        marshall_video(coordinates, video_proto, data, format, start_time)
        return self.dg._enqueue("video", video_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


# Regular expression explained at https://regexr.com/4n2l2 Covers any youtube
# URL (incl. shortlinks and embed links) and extracts its code.
YOUTUBE_RE: Final = re.compile(
    # Protocol
    r"http(?:s?):\/\/"
    # Domain
    r"(?:www\.)?youtu(?:be\.com|\.be)\/"
    # Path and query string
    r"(?P<watch>(watch\?v=)|embed\/)?(?P<code>[\w\-\_]*)(&(amp;)?[\w\?=]*)?"
)


def _reshape_youtube_url(url: str) -> Optional[str]:
    """Return whether URL is any kind of YouTube embed or watch link.  If so,
    reshape URL into an embed link suitable for use in an iframe.

    If not a YouTube URL, return None.

    Parameters
    ----------
        url : str

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


def _marshall_av_media(
    coordinates: str,
    proto: Union[AudioProto, VideoProto],
    data: MediaData,
    mimetype: str,
) -> None:
    """Fill audio or video proto based on contents of data.

    Given a string, check if it's a url; if so, send it out without modification.
    Otherwise assume strings are filenames and let any OS errors raise.

    Load data either from file or through bytes-processing methods into a
    MediaFile object.  Pack proto with generated Tornado-based URL.

    (When running in "raw" mode, we won't actually load data into the
    MediaFileManager, and we'll return an empty URL.)
    """
    # Audio and Video methods have already checked if this is a URL by this point.

    if data is None:
        # Allow empty values so media players can be shown without media.
        return

    data_or_filename: Union[bytes, str]
    if isinstance(data, (str, bytes)):
        # Pass strings and bytes through unchanged
        data_or_filename = data
    elif isinstance(data, io.BytesIO):
        data.seek(0)
        data_or_filename = data.getvalue()
    elif isinstance(data, io.RawIOBase) or isinstance(data, io.BufferedReader):
        data.seek(0)
        read_data = data.read()
        if read_data is None:
            return
        else:
            data_or_filename = read_data
    elif type_util.is_type(data, "numpy.ndarray"):
        data_or_filename = data.tobytes()
    else:
        raise RuntimeError("Invalid binary data format: %s" % type(data))

    if runtime.exists():
        file_url = runtime.get_instance().media_file_mgr.add(
            data_or_filename, mimetype, coordinates
        )
    else:
        # When running in "raw mode", we can't access the MediaFileManager.
        file_url = ""

    proto.url = file_url


def marshall_video(
    coordinates: str,
    proto: VideoProto,
    data: MediaData,
    mimetype: str = "video/mp4",
    start_time: int = 0,
) -> None:
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


def marshall_audio(
    coordinates: str,
    proto: AudioProto,
    data: MediaData,
    mimetype: str = "audio/wav",
    start_time: int = 0,
) -> None:
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
