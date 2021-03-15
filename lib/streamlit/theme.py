# Copyright 2018-2021 Streamlit Inc.
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
import enum


RESERVED_THEME_NAMES = {"auto", "dark", "light"}


class ThemeCompleteness(enum.Enum):
    FULLY_DEFINED = 1
    NOT_DEFINED = 2
    PARTIALLY_DEFINED = 3


def check_theme_completeness(theme_opts):
    optional_theme_options = {"font"}
    required_opts = set(theme_opts.keys()) - optional_theme_options

    if all([bool(theme_opts[k]) for k in required_opts]):
        return ThemeCompleteness.FULLY_DEFINED

    if all([not bool(theme_opts[k]) for k in required_opts]):
        return ThemeCompleteness.NOT_DEFINED

    return ThemeCompleteness.PARTIALLY_DEFINED
