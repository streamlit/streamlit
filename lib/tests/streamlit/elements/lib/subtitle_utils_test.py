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

from parameterized import parameterized

from streamlit.elements.lib.subtitle_utils import (
    _is_srt,
    _srt_to_vtt,
    process_subtitle_data,
)
from tests.delta_generator_test_case import DeltaGeneratorTestCase

SRT_DATA_EN = """
1
00:01:47,250 --> 00:01:50,500
This blade has a dark past.

2
00:01:51,800 --> 00:01:55,800
It has shed much innocent blood.

3
00:01:58,000 --> 00:02:01,450
You're a fool for traveling alone,
so completely unprepared.
"""

VTT_DATA_EN = (
    b"WEBVTT\n\n\n1\n00:01:47.250 --> 00:01:50.500\nThis blade has a dark past."
    b"\n\n2\n00:01:51.800 --> 00:01:55.800\nIt has shed much innocent blood.\n\n"
    b"3\n00:01:58.000 --> 00:02:01.450\nYou're a fool for traveling alone,\nso co"
    b"mpletely unprepared."
)

SRT_DATA_FR = """
1
00:01:47,250 --> 00:01:50,500
Cette lame a un sombre passé.

2
00:01:51,800 --> 00:01:55,800
Elle a fait couler bien du sang innocent.

3
00:01:58,000 --> 00:02:01,450
Tu es bien idiote de voyager seule
sans la moindre préparation.

4
00:02:01,750 --> 00:02:04,800
Tu as de la chance que ton sang coule encore
dans tes veines.

5
00:02:05,250 --> 00:02:06,300
Merci.
"""

VTT_DATA_FR = (
    b"WEBVTT\n\n\n1\n00:01:47.250 --> 00:01:50.500\nCette lame a un sombre pass"
    b"\xc3\xa9.\n\n2\n00:01:51.800 --> 00:01:55.800\nElle a fait couler bien du "
    b"sang innocent.\n\n3\n00:01:58.000 --> 00:02:01.450\nTu es bien idiote de voy"
    b"ager seule\nsans la moindre pr\xc3\xa9paration.\n\n4\n00:02:01.750 --> 00:"
    b"02:04.800\nTu as de la chance que ton sang coule encore\ndans tes veines.\n"
    b"\n5\n00:02:05.250 --> 00:02:06.300\nMerci."
)

SRT_DATA_INVALID = """HELLO WORLD!"""


class SubtitleUtilsTest(DeltaGeneratorTestCase):
    def test_is_srt(self):
        """Test is_srt function."""

        self.assertTrue(_is_srt(SRT_DATA_EN))
        self.assertTrue(_is_srt(SRT_DATA_FR))
        self.assertFalse(_is_srt(SRT_DATA_INVALID))

    @parameterized.expand(
        [
            (SRT_DATA_EN, VTT_DATA_EN),
            (SRT_DATA_FR, VTT_DATA_FR),
        ]
    )
    def test_srt_vtt(self, srt_string: str, expected: bytes):
        """Test srt to vtt format transition."""

        self.assertEqual(
            _srt_to_vtt(srt_string),
            expected,
            f"Expected {srt_string} to be transformed into {str(expected)}.",
        )

    def test_srt_vtt_bytes(self):
        """Test srt to vtt format transition with bytes."""
        self.assertEqual(
            _srt_to_vtt(SRT_DATA_EN.encode("utf-8")),
            VTT_DATA_EN,
            f"Expected {SRT_DATA_EN} to be transformed into {str(VTT_DATA_EN)}.",
        )

    def test_process_subtitle_data(self):
        """Test process_subtitle_data function."""
        url = process_subtitle_data("[0, 0]", SRT_DATA_EN, "English")
        file_id = url.split("/")[-1].split(".")[0]
        media_file = self.media_file_storage.get_file(file_id)
        self.assertIsNotNone(media_file)
        self.assertEqual(media_file.content, _srt_to_vtt(SRT_DATA_EN.strip()))
        self.assertEqual(media_file.mimetype, "text/vtt")
