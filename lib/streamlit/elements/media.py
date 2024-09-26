# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from __future__ import annotations

import io
import re
from datetime import timedelta
from pathlib import Path
from typing import TYPE_CHECKING, Dict, Final, Union, cast

from typing_extensions import TypeAlias

from streamlit import runtime, type_util, url_util
from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.subtitle_utils import process_subtitle_data
from streamlit.elements.lib.utils import compute_and_register_element_id
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Audio_pb2 import Audio as AudioProto
from streamlit.proto.Video_pb2 import Video as VideoProto
from streamlit.runtime import caching
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.time_util import time_to_seconds
from streamlit.type_util import NumpyShape

if TYPE_CHECKING:
    from typing import Any

    from numpy import typing as npt

    from streamlit.delta_generator import DeltaGenerator


MediaData: TypeAlias = Union[
    str, bytes, io.BytesIO, io.RawIOBase, io.BufferedReader, "npt.NDArray[Any]", None
]

SubtitleData: TypeAlias = Union[
    str, Path, bytes, io.BytesIO, Dict[str, Union[str, Path, bytes, io.BytesIO]], None
]

MediaTime: TypeAlias = Union[int, float, timedelta, str]

TIMEDELTA_PARSE_ERROR_MESSAGE: Final = (
    "Failed to convert '{param_name}' to a timedelta. "
    "Please use a string in a format supported by "
    "[Pandas Timedelta constructor]"
    "(https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html), "
    'e.g. `"10s"`, `"15 seconds"`, or `"1h23s"`. Got: {param_value}'
)


class MediaMixin:
    @gather_metrics("audio")
    def audio(
        self,
        data: MediaData,
        format: str = "audio/wav",
        start_time: MediaTime = 0,
        *,
        sample_rate: int | None = None,
        end_time: MediaTime | None = None,
        loop: bool = False,
        autoplay: bool = False,
    ) -> DeltaGenerator:
        """Display an audio player.

        Parameters
        ----------
        data : str, bytes, BytesIO, numpy.ndarray, or file
            Raw audio data, filename, or a URL pointing to the file to load.
            Raw data formats must include all necessary file headers to match the file
            format specified via ``format``.
            If ``data`` is a numpy array, it must either be a 1D array of the waveform
            or a 2D array of shape ``(num_channels, num_samples)`` with waveforms
            for all channels. See the default channel order at
            http://msdn.microsoft.com/en-us/library/windows/hardware/dn653308(v=vs.85).aspx

        format : str
            The mime type for the audio file. Defaults to ``"audio/wav"``.
            See https://tools.ietf.org/html/rfc4281 for more info.

        start_time: int, float, timedelta, str, or None
            The time from which the element should start playing. This can be
            one of the following:

            * ``None`` (default): The element plays from the beginning.
            * An ``int`` or ``float`` specifying the time in seconds. ``float``
              values are rounded down to whole seconds.
            * A string specifying the time in a format supported by `Pandas'
              Timedelta constructor <https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html>`_,
              e.g. ``"2 minute"``, ``"20s"``, or ``"1m14s"``.
            * A ``timedelta`` object from `Python's built-in datetime library
              <https://docs.python.org/3/library/datetime.html#timedelta-objects>`_,
              e.g. ``timedelta(seconds=70)``.
        sample_rate: int or None
            The sample rate of the audio data in samples per second. Only required if
            ``data`` is a numpy array.
        end_time: int, float, timedelta, str, or None
            The time at which the element should stop playing. This can be
            one of the following:

            * ``None`` (default): The element plays through to the end.
            * An ``int`` or ``float`` specifying the time in seconds. ``float``
              values are rounded down to whole seconds.
            * A string specifying the time in a format supported by `Pandas'
              Timedelta constructor <https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html>`_,
              e.g. ``"2 minute"``, ``"20s"``, or ``"1m14s"``.
            * A ``timedelta`` object from `Python's built-in datetime library
              <https://docs.python.org/3/library/datetime.html#timedelta-objects>`_,
              e.g. ``timedelta(seconds=70)``.
        loop: bool
            Whether the audio should loop playback.
        autoplay: bool
            Whether the audio file should start playing automatically. This is
            ``False`` by default. Browsers will not autoplay audio files if the
            user has not interacted with the page by clicking somewhere.

        Examples
        --------
        To display an audio player for a local file, specify the file's string
        path and format.

        >>> import streamlit as st
        >>>
        >>> st.audio("cat-purr.mp3", format="audio/mpeg", loop=True)

        .. output::
           https://doc-audio-purr.streamlit.app/
           height: 250px

        You can also pass ``bytes`` or ``numpy.ndarray`` objects to ``st.audio``.

        >>> import streamlit as st
        >>> import numpy as np
        >>>
        >>> audio_file = open("myaudio.ogg", "rb")
        >>> audio_bytes = audio_file.read()
        >>>
        >>> st.audio(audio_bytes, format="audio/ogg")
        >>>
        >>> sample_rate = 44100  # 44100 samples per second
        >>> seconds = 2  # Note duration of 2 seconds
        >>> frequency_la = 440  # Our played note will be 440 Hz
        >>> # Generate array with seconds*sample_rate steps, ranging between 0 and seconds
        >>> t = np.linspace(0, seconds, seconds * sample_rate, False)
        >>> # Generate a 440 Hz sine wave
        >>> note_la = np.sin(frequency_la * t * 2 * np.pi)
        >>>
        >>> st.audio(note_la, sample_rate=sample_rate)

        .. output::
           https://doc-audio.streamlit.app/
           height: 865px

        """
        start_time, end_time = _parse_start_time_end_time(start_time, end_time)

        audio_proto = AudioProto()

        is_data_numpy_array = type_util.is_type(data, "numpy.ndarray")

        if is_data_numpy_array and sample_rate is None:
            raise StreamlitAPIException(
                "`sample_rate` must be specified when `data` is a numpy array."
            )
        if not is_data_numpy_array and sample_rate is not None:
            self.dg.warning(
                "Warning: `sample_rate` will be ignored since data is not a numpy "
                "array."
            )
        coordinates = self.dg._get_delta_path_str()
        marshall_audio(
            coordinates,
            audio_proto,
            data,
            format,
            start_time,
            sample_rate,
            end_time,
            loop,
            autoplay,
            form_id=current_form_id(self.dg),
        )
        return self.dg._enqueue("audio", audio_proto)

    @gather_metrics("video")
    def video(
        self,
        data: MediaData,
        format: str = "video/mp4",
        start_time: MediaTime = 0,
        *,  # keyword-only arguments:
        subtitles: SubtitleData = None,
        end_time: MediaTime | None = None,
        loop: bool = False,
        autoplay: bool = False,
        muted: bool = False,
    ) -> DeltaGenerator:
        """Display a video player.

        Parameters
        ----------
        data : str, bytes, io.BytesIO, numpy.ndarray, or file
            Raw video data, filename, or URL pointing to a video to load.
            Includes support for YouTube URLs.
            Numpy arrays and raw data formats must include all necessary file
            headers to match specified file format.

        format : str
            The mime type for the video file. Defaults to ``"video/mp4"``.
            See https://tools.ietf.org/html/rfc4281 for more info.

        start_time: int, float, timedelta, str, or None
            The time from which the element should start playing. This can be
            one of the following:

            * ``None`` (default): The element plays from the beginning.
            * An ``int`` or ``float`` specifying the time in seconds. ``float``
              values are rounded down to whole seconds.
            * A string specifying the time in a format supported by `Pandas'
              Timedelta constructor <https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html>`_,
              e.g. ``"2 minute"``, ``"20s"``, or ``"1m14s"``.
            * A ``timedelta`` object from `Python's built-in datetime library
              <https://docs.python.org/3/library/datetime.html#timedelta-objects>`_,
              e.g. ``timedelta(seconds=70)``.
        subtitles: str, bytes, Path, io.BytesIO, or dict
            Optional subtitle data for the video, supporting several input types:

            * ``None`` (default): No subtitles.

            * A string, bytes, or Path: File path to a subtitle file in ``.vtt`` or ``.srt`` formats, or
              the raw content of subtitles conforming to these formats.
              If providing raw content, the string must adhere to the WebVTT or SRT
              format specifications.

            * io.BytesIO: A BytesIO stream that contains valid ``.vtt`` or ``.srt``
              formatted subtitle data.

            * A dictionary: Pairs of labels and file paths or raw subtitle content in
              ``.vtt`` or ``.srt`` formats to enable multiple subtitle tracks.
              The label will be shown in the video player. Example:
              ``{"English": "path/to/english.vtt", "French": "path/to/french.srt"}``

            When provided, subtitles are displayed by default. For multiple
            tracks, the first one is displayed by default. If you don't want any
            subtitles displayed by default, use an empty string for the value
            in a dictrionary's first pair: ``{"None": "", "English": "path/to/english.vtt"}``

            Not supported for YouTube videos.
        end_time: int, float, timedelta, str, or None
            The time at which the element should stop playing. This can be
            one of the following:

            * ``None`` (default): The element plays through to the end.
            * An ``int`` or ``float`` specifying the time in seconds. ``float``
              values are rounded down to whole seconds.
            * A string specifying the time in a format supported by `Pandas'
              Timedelta constructor <https://pandas.pydata.org/docs/reference/api/pandas.Timedelta.html>`_,
              e.g. ``"2 minute"``, ``"20s"``, or ``"1m14s"``.
            * A ``timedelta`` object from `Python's built-in datetime library
              <https://docs.python.org/3/library/datetime.html#timedelta-objects>`_,
              e.g. ``timedelta(seconds=70)``.
        loop: bool
            Whether the video should loop playback.
        autoplay: bool
            Whether the video should start playing automatically. This is
            ``False`` by default. Browsers will not autoplay unmuted videos
            if the user has not interacted with the page by clicking somewhere.
            To enable autoplay without user interaction, you must also set
            ``muted=True``.
        muted: bool
            Whether the video should play with the audio silenced. This is
            ``False`` by default. Use this in conjunction with ``autoplay=True``
            to enable autoplay without user interaction.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> video_file = open("myvideo.mp4", "rb")
        >>> video_bytes = video_file.read()
        >>>
        >>> st.video(video_bytes)

        .. output::
           https://doc-video.streamlit.app/
           height: 700px

        When you include subtitles, they will be turned on by default. A viewer
        can turn off the subtitles (or captions) from the browser's default video
        control menu, usually located in the lower-right corner of the video.

        Here is a simple VTT file (``subtitles.vtt``):

        >>> WEBVTT
        >>>
        >>> 0:00:01.000 --> 0:00:02.000
        >>> Look!
        >>>
        >>> 0:00:03.000 --> 0:00:05.000
        >>> Look at the pretty stars!

        If the above VTT file lives in the same directory as your app, you can
        add subtitles like so:

        >>> import streamlit as st
        >>>
        >>> VIDEO_URL = "https://example.com/not-youtube.mp4"
        >>> st.video(VIDEO_URL, subtitles="subtitles.vtt")

        .. output::
           https://doc-video-subtitles.streamlit.app/
           height: 700px

        See additional examples of supported subtitle input types in our
        `video subtitles feature demo <https://doc-video-subtitle-inputs.streamlit.app/>`_.

        .. note::
           Some videos may not display if they are encoded using MP4V (which is an export option in OpenCV), as this codec is
           not widely supported by browsers. Converting your video to H.264 will allow the video to be displayed in Streamlit.
           See this `StackOverflow post <https://stackoverflow.com/a/49535220/2394542>`_ or this
           `Streamlit forum post <https://discuss.streamlit.io/t/st-video-doesnt-show-opencv-generated-mp4/3193/2>`_
           for more information.

        """
        start_time, end_time = _parse_start_time_end_time(start_time, end_time)

        video_proto = VideoProto()
        coordinates = self.dg._get_delta_path_str()
        marshall_video(
            coordinates,
            video_proto,
            data,
            format,
            start_time,
            subtitles,
            end_time,
            loop,
            autoplay,
            muted,
            form_id=current_form_id(self.dg),
        )
        return self.dg._enqueue("video", video_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


# Regular expression from
# https://gist.github.com/rodrigoborgesdeoliveira/987683cfbfcc8d800192da1e73adc486?permalink_comment_id=4645864#gistcomment-4645864
# Covers any youtube URL (incl. shortlinks and embed links) and extracts its video code.
YOUTUBE_RE: Final = r"^((https?://(?:www\.)?(?:m\.)?youtube\.com))/((?:oembed\?url=https?%3A//(?:www\.)youtube.com/watch\?(?:v%3D)(?P<video_id_1>[\w\-]{10,20})&format=json)|(?:attribution_link\?a=.*watch(?:%3Fv%3D|%3Fv%3D)(?P<video_id_2>[\w\-]{10,20}))(?:%26feature.*))|(https?:)?(\/\/)?((www\.|m\.)?youtube(-nocookie)?\.com\/((watch)?\?(app=desktop&)?(feature=\w*&)?v=|embed\/|v\/|e\/)|youtu\.be\/)(?P<video_id_3>[\w\-]{10,20})"


def _reshape_youtube_url(url: str) -> str | None:
    """Return whether URL is any kind of YouTube embed or watch link.  If so,
    reshape URL into an embed link suitable for use in an iframe.

    If not a YouTube URL, return None.

    Parameters
    ----------
        url : str

    Example
    -------
    >>> print(_reshape_youtube_url("https://youtu.be/_T8LGqJtuGc"))

    .. output::
        https://www.youtube.com/embed/_T8LGqJtuGc
    """
    match = re.match(YOUTUBE_RE, url)
    if match:
        code = (
            match.group("video_id_1")
            or match.group("video_id_2")
            or match.group("video_id_3")
        )
        return f"https://www.youtube.com/embed/{code}"
    return None


def _marshall_av_media(
    coordinates: str,
    proto: AudioProto | VideoProto,
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

    data_or_filename: bytes | str
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
        caching.save_media_data(data_or_filename, mimetype, coordinates)
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
    subtitles: SubtitleData = None,
    end_time: int | None = None,
    loop: bool = False,
    autoplay: bool = False,
    muted: bool = False,
    form_id: str | None = None,
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
    subtitles: str, dict, or io.BytesIO
        Optional subtitle data for the video, supporting several input types:
        * None (default): No subtitles.
        * A string: File path to a subtitle file in '.vtt' or '.srt' formats, or the raw content of subtitles conforming to these formats.
            If providing raw content, the string must adhere to the WebVTT or SRT format specifications.
        * A dictionary: Pairs of labels and file paths or raw subtitle content in '.vtt' or '.srt' formats.
            Enables multiple subtitle tracks. The label will be shown in the video player.
            Example: {'English': 'path/to/english.vtt', 'French': 'path/to/french.srt'}
        * io.BytesIO: A BytesIO stream that contains valid '.vtt' or '.srt' formatted subtitle data.
        When provided, subtitles are displayed by default. For multiple tracks, the first one is displayed by default.
        Not supported for YouTube videos.
    end_time: int
            The time at which this element should stop playing
    loop: bool
        Whether the video should loop playback.
    autoplay: bool
        Whether the video should start playing automatically.
        Browsers will not autoplay video files if the user has not interacted with
        the page yet, for example by clicking on the page while it loads.
        To enable autoplay without user interaction, you can set muted=True.
        Defaults to False.
    muted: bool
        Whether the video should play with the audio silenced. This can be used to
        enable autoplay without user interaction. Defaults to False.
    form_id: str | None
        The ID of the form that this element is placed in. Provide None if
        the element is not placed in a form.
    """

    if start_time < 0 or (end_time is not None and end_time <= start_time):
        raise StreamlitAPIException("Invalid start_time and end_time combination.")

    proto.start_time = start_time
    proto.muted = muted

    if end_time is not None:
        proto.end_time = end_time
    proto.loop = loop

    # "type" distinguishes between YouTube and non-YouTube links
    proto.type = VideoProto.Type.NATIVE

    if isinstance(data, str) and url_util.is_url(
        data, allowed_schemas=("http", "https", "data")
    ):
        if youtube_url := _reshape_youtube_url(data):
            proto.url = youtube_url
            proto.type = VideoProto.Type.YOUTUBE_IFRAME
            if subtitles:
                raise StreamlitAPIException(
                    "Subtitles are not supported for YouTube videos."
                )
        else:
            proto.url = data

    else:
        _marshall_av_media(coordinates, proto, data, mimetype)

    if subtitles:
        subtitle_items: list[tuple[str, str | Path | bytes | io.BytesIO]] = []

        # Single subtitle
        if isinstance(subtitles, (str, bytes, io.BytesIO, Path)):
            subtitle_items.append(("default", subtitles))
        # Multiple subtitles
        elif isinstance(subtitles, dict):
            subtitle_items.extend(subtitles.items())
        else:
            raise StreamlitAPIException(
                f"Unsupported data type for subtitles: {type(subtitles)}. "
                f"Only str (file paths) and dict are supported."
            )

        for label, subtitle_data in subtitle_items:
            sub = proto.subtitles.add()
            sub.label = label or ""

            # Coordinates used in media_file_manager to identify the place of
            # element, in case of subtitle, we use same video coordinates
            # with suffix.
            # It is not aligned with common coordinates format, but in
            # media_file_manager we use it just as unique identifier, so it is fine.
            subtitle_coordinates = f"{coordinates}[subtitle{label}]"
            try:
                sub.url = process_subtitle_data(
                    subtitle_coordinates, subtitle_data, label
                )
            except (TypeError, ValueError) as original_err:
                raise StreamlitAPIException(
                    f"Failed to process the provided subtitle: {label}"
                ) from original_err

    if autoplay:
        proto.autoplay = autoplay
        proto.id = compute_and_register_element_id(
            "video",
            # video does not yet allow setting a user-defined key
            user_key=None,
            form_id=form_id,
            url=proto.url,
            mimetype=mimetype,
            start_time=start_time,
            end_time=end_time,
            loop=loop,
            autoplay=autoplay,
            muted=muted,
        )


def _parse_start_time_end_time(
    start_time: MediaTime, end_time: MediaTime | None
) -> tuple[int, int | None]:
    """Parse start_time and end_time and return them as int."""

    try:
        maybe_start_time = time_to_seconds(start_time, coerce_none_to_inf=False)
        if maybe_start_time is None:
            raise ValueError
        start_time = int(maybe_start_time)
    except (StreamlitAPIException, ValueError):
        error_msg = TIMEDELTA_PARSE_ERROR_MESSAGE.format(
            param_name="start_time", param_value=start_time
        )
        raise StreamlitAPIException(error_msg) from None

    try:
        end_time = time_to_seconds(end_time, coerce_none_to_inf=False)
        if end_time is not None:
            end_time = int(end_time)
    except StreamlitAPIException:
        error_msg = TIMEDELTA_PARSE_ERROR_MESSAGE.format(
            param_name="end_time", param_value=end_time
        )
        raise StreamlitAPIException(error_msg) from None

    return start_time, end_time


def _validate_and_normalize(data: npt.NDArray[Any]) -> tuple[bytes, int]:
    """Validates and normalizes numpy array data.
    We validate numpy array shape (should be 1d or 2d)
    We normalize input data to int16 [-32768, 32767] range.

    Parameters
    ----------
    data : numpy array
        numpy array to be validated and normalized

    Returns
    -------
    Tuple of (bytes, int)
        (bytes, nchan)
        where
         - bytes : bytes of normalized numpy array converted to int16
         - nchan : number of channels for audio signal. 1 for mono, or 2 for stereo.
    """
    # we import numpy here locally to import it only when needed (when numpy array given
    # to st.audio data)
    import numpy as np

    transformed_data: npt.NDArray[Any] = np.array(data, dtype=float)

    if len(cast(NumpyShape, transformed_data.shape)) == 1:
        nchan = 1
    elif len(transformed_data.shape) == 2:
        # In wave files,channels are interleaved. E.g.,
        # "L1R1L2R2..." for stereo. See
        # http://msdn.microsoft.com/en-us/library/windows/hardware/dn653308(v=vs.85).aspx
        # for channel ordering
        nchan = transformed_data.shape[0]
        transformed_data = transformed_data.T.ravel()
    else:
        raise StreamlitAPIException("Numpy array audio input must be a 1D or 2D array.")

    if transformed_data.size == 0:
        return transformed_data.astype(np.int16).tobytes(), nchan

    max_abs_value = np.max(np.abs(transformed_data))
    # 16-bit samples are stored as 2's-complement signed integers,
    # ranging from -32768 to 32767.
    # scaled_data is PCM 16 bit numpy array, that's why we multiply [-1, 1] float
    # values to 32_767 == 2 ** 15 - 1.
    np_array = (transformed_data / max_abs_value) * 32767
    scaled_data = np_array.astype(np.int16)
    return scaled_data.tobytes(), nchan


def _make_wav(data: npt.NDArray[Any], sample_rate: int) -> bytes:
    """
    Transform a numpy array to a PCM bytestring
    We use code from IPython display module to convert numpy array to wave bytes
    https://github.com/ipython/ipython/blob/1015c392f3d50cf4ff3e9f29beede8c1abfdcb2a/IPython/lib/display.py#L146
    """
    # we import wave here locally to import it only when needed (when numpy array given
    # to st.audio data)
    import wave

    scaled, nchan = _validate_and_normalize(data)

    with io.BytesIO() as fp, wave.open(fp, mode="wb") as waveobj:
        waveobj.setnchannels(nchan)
        waveobj.setframerate(sample_rate)
        waveobj.setsampwidth(2)
        waveobj.setcomptype("NONE", "NONE")
        waveobj.writeframes(scaled)
        return fp.getvalue()


def _maybe_convert_to_wav_bytes(data: MediaData, sample_rate: int | None) -> MediaData:
    """Convert data to wav bytes if the data type is numpy array."""
    if type_util.is_type(data, "numpy.ndarray") and sample_rate is not None:
        data = _make_wav(cast("npt.NDArray[Any]", data), sample_rate)
    return data


def marshall_audio(
    coordinates: str,
    proto: AudioProto,
    data: MediaData,
    mimetype: str = "audio/wav",
    start_time: int = 0,
    sample_rate: int | None = None,
    end_time: int | None = None,
    loop: bool = False,
    autoplay: bool = False,
    form_id: str | None = None,
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
    sample_rate: int or None
        Optional param to provide sample_rate in case of numpy array
    end_time: int
        The time at which this element should stop playing
    loop: bool
        Whether the audio should loop playback.
    autoplay : bool
        Whether the audio should start playing automatically.
        Browsers will not autoplay audio files if the user has not interacted with the page yet.
    form_id: str | None
        The ID of the form that this element is placed in. Provide None if
        the element is not placed in a form.
    """

    proto.start_time = start_time
    if end_time is not None:
        proto.end_time = end_time
    proto.loop = loop

    if isinstance(data, str) and url_util.is_url(
        data, allowed_schemas=("http", "https", "data")
    ):
        proto.url = data

    else:
        data = _maybe_convert_to_wav_bytes(data, sample_rate)
        _marshall_av_media(coordinates, proto, data, mimetype)

    if autoplay:
        proto.autoplay = autoplay
        proto.id = compute_and_register_element_id(
            "audio",
            user_key=None,
            form_id=form_id,
            url=proto.url,
            mimetype=mimetype,
            start_time=start_time,
            sample_rate=sample_rate,
            end_time=end_time,
            loop=loop,
            autoplay=autoplay,
        )
