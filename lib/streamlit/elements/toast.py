# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from typing import TYPE_CHECKING, Literal, cast

from streamlit.errors import StreamlitAPIException, StreamlitValueError
from streamlit.proto.Toast_pb2 import Toast as ToastProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text, validate_icon_or_emoji

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import SupportsStr


def validate_text(toast_text: SupportsStr) -> SupportsStr:
    if str(toast_text) == "":
        raise StreamlitAPIException(
            "Toast body cannot be blank - please provide a message."
        )
    return toast_text


class ToastMixin:
    @gather_metrics("toast")
    def toast(
        self,
        body: SupportsStr,
        *,  # keyword-only args:
        icon: str | None = None,
        duration: Literal["short", "long", "infinite"] | int = "short",
    ) -> DeltaGenerator:
        """Display a short message, known as a notification "toast".
        The toast appears in the app's top-right corner and disappears after four seconds.

        .. warning::
            ``st.toast`` is not compatible with Streamlit's `caching \
            <https://docs.streamlit.io/develop/concepts/architecture/caching>`_ and
            cannot be called within a cached function.

        Parameters
        ----------
        body : str
            The string to display as GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        icon : str, None
            An optional emoji or icon to display next to the alert. If ``icon``
            is ``None`` (default), no icon is displayed. If ``icon`` is a
            string, the following options are valid:

            - A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            - An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

            - ``"spinner"``: Displays a spinner as an icon.

        duration : "short", "long", "infinite", or int
            The time to display the toast message. This can be one of the
            following:

            - ``"short"`` (default): Displays for 4 seconds.
            - ``"long"``: Displays for 10 seconds.
            - ``"infinite"``: Shows the toast until the user dismisses it.
            - An integer: Displays for the specified number of seconds.

        Examples
        --------
        **Example 1: Show a toast message**

        >>> import streamlit as st
        >>>
        >>> st.toast("Your edited image was saved!", icon="😍")

        .. output::
            https://doc-status-toast.streamlit.app
            height: 200px

        **Example 2: Show multiple toasts**

        When multiple toasts are generated, they will stack. Hovering over a
        toast will stop it from disappearing. When hovering ends, the toast
        will disappear after time specified in ``duration``.

        >>> import time
        >>> import streamlit as st
        >>>
        >>> if st.button("Three cheers"):
        >>>     st.toast("Hip!")
        >>>     time.sleep(0.5)
        >>>     st.toast("Hip!")
        >>>     time.sleep(0.5)
        >>>     st.toast("Hooray!", icon="🎉")

        .. output::
            https://doc-status-toast1.streamlit.app
            height: 300px

        **Example 3: Update a toast message**

        Toast messages can also be updated. Assign ``st.toast(my_message)`` to
        a variable and use the ``.toast()`` method to update it. If a toast has
        already disappeared or been dismissed, the update will not be seen.

        >>> import time
        >>> import streamlit as st
        >>>
        >>> def cook_breakfast():
        >>>     msg = st.toast("Gathering ingredients...")
        >>>     time.sleep(1)
        >>>     msg.toast("Cooking...")
        >>>     time.sleep(1)
        >>>     msg.toast("Ready!", icon="🥞")
        >>>
        >>> if st.button("Cook breakfast"):
        >>>     cook_breakfast()

        .. output::
            https://doc-status-toast2.streamlit.app
            height: 200px

        """
        toast_proto = ToastProto()
        toast_proto.body = clean_text(validate_text(body))
        toast_proto.icon = validate_icon_or_emoji(icon)

        if duration in ["short", "long", "infinite"] or (
            isinstance(duration, int) and duration > 0
        ):
            if duration == "short":
                toast_proto.duration = 4
            elif duration == "long":
                toast_proto.duration = 10
            elif duration == "infinite":
                toast_proto.duration = 0
            else:
                toast_proto.duration = duration
        else:
            raise StreamlitValueError(
                "duration", ["short", "long", "infinite", "a positive integer"]
            )

        return self.dg._enqueue("toast", toast_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
