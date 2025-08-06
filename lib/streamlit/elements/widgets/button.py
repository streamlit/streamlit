# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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
import os
from dataclasses import dataclass
from pathlib import Path
from textwrap import dedent
from typing import (
    TYPE_CHECKING,
    BinaryIO,
    Final,
    Literal,
    TextIO,
    Union,
    cast,
)

from typing_extensions import TypeAlias

from streamlit import runtime
from streamlit.elements.lib.form_utils import current_form_id, is_in_form
from streamlit.elements.lib.layout_utils import LayoutConfig, Width, validate_width
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    save_for_app_testing,
    to_key,
)
from streamlit.errors import (
    StreamlitAPIException,
    StreamlitMissingPageLabelError,
    StreamlitPageNotFoundError,
)
from streamlit.file_util import get_main_script_directory, normalize_path_join
from streamlit.navigation.page import StreamlitPage
from streamlit.proto.Button_pb2 import Button as ButtonProto
from streamlit.proto.DownloadButton_pb2 import DownloadButton as DownloadButtonProto
from streamlit.proto.LinkButton_pb2 import LinkButton as LinkButtonProto
from streamlit.proto.PageLink_pb2 import PageLink as PageLinkProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.string_util import validate_icon_or_emoji
from streamlit.url_util import is_url
from streamlit.util import in_sidebar

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

FORM_DOCS_INFO: Final = """

For more information, refer to the
[documentation for forms](https://docs.streamlit.io/develop/api-reference/execution-flow/st.form).
"""

DownloadButtonDataType: TypeAlias = Union[str, bytes, TextIO, BinaryIO, io.RawIOBase]


@dataclass
class ButtonSerde:
    def serialize(self, v: bool) -> bool:
        return bool(v)

    def deserialize(self, ui_value: bool | None) -> bool:
        return ui_value or False


class ButtonMixin:
    @gather_metrics("button")
    def button(
        self,
        label: str,
        key: Key | None = None,
        help: str | None = None,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool | None = None,
        width: Width = "content",
    ) -> bool:
        r"""Display a button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        help : str or None
            A tooltip that gets displayed when the button is hovered over. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_click : callable
            An optional callback invoked when this button is clicked.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        type : "primary", "secondary", or "tertiary"
            An optional string that specifies the button type. This can be one
            of the following:

            - ``"primary"``: The button's background is the app's primary color
              for additional emphasis.
            - ``"secondary"`` (default): The button's background coordinates
              with the app's background color for normal emphasis.
            - ``"tertiary"``: The button is plain text without a border or
              background for subtlety.

        icon : str or None
            An optional emoji or icon to display next to the button label. If ``icon``
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

        disabled : bool
            An optional boolean that disables the button if set to ``True``.
            The default is ``False``.

        use_container_width : bool
            Whether to expand the button's width to fill its parent container.
            If ``use_container_width`` is ``False`` (default), Streamlit sizes
            the button to fit its contents. If ``use_container_width`` is
            ``True``, the width of the button matches its parent container.

            In both cases, if the contents of the button are wider than the
            parent container, the contents will line wrap.

        width : "content", "stretch", or int
            The width of the button. This can be one of the following:

            - ``"content"`` (default): The width of the button matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the button matches the width of the
              parent container.
            - An integer specifying the width in pixels: The button has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the button matches the width
              of the parent container.

        .. deprecated::
            ``use_container_width`` is deprecated and will be removed in a
            future release. For ``use_container_width=True``, use
            ``width="stretch"``. For ``use_container_width=False``, use
            ``width="content"``.

        Returns
        -------
        bool
            True if the button was clicked on the last run of the app,
            False otherwise.

        Examples
        --------
        **Example 1: Customize your button type**

        >>> import streamlit as st
        >>>
        >>> st.button("Reset", type="primary")
        >>> if st.button("Say hello"):
        ...     st.write("Why hello there")
        ... else:
        ...     st.write("Goodbye")
        >>>
        >>> if st.button("Aloha", type="tertiary"):
        ...     st.write("Ciao")

        .. output::
           https://doc-buton.streamlit.app/
           height: 300px

        **Example 2: Add icons to your button**

        Although you can add icons to your buttons through Markdown, the
        ``icon`` parameter is a convenient and consistent alternative.

        >>> import streamlit as st
        >>>
        >>> left, middle, right = st.columns(3)
        >>> if left.button("Plain button", width="stretch"):
        ...     left.markdown("You clicked the plain button.")
        >>> if middle.button("Emoji button", icon="😃", width="stretch"):
        ...     middle.markdown("You clicked the emoji button.")
        >>> if right.button("Material button", icon=":material/mood:", width="stretch"):
        ...     right.markdown("You clicked the Material button.")

        .. output::
           https://doc-button-icons.streamlit.app/
           height: 220px

        """
        key = to_key(key)
        ctx = get_script_run_ctx()

        if use_container_width is not None:
            width = "stretch" if use_container_width else "content"

        # Checks whether the entered button type is one of the allowed options
        if type not in ["primary", "secondary", "tertiary"]:
            raise StreamlitAPIException(
                'The type argument to st.button must be "primary", "secondary", or "tertiary". '
                f'\nThe argument passed was "{type}".'
            )

        return self.dg._button(
            label,
            key,
            help,
            is_form_submitter=False,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            disabled=disabled,
            type=type,
            icon=icon,
            ctx=ctx,
            width=width,
        )

    @gather_metrics("download_button")
    def download_button(
        self,
        label: str,
        data: DownloadButtonDataType,
        file_name: str | None = None,
        mime: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_click: WidgetCallback | Literal["rerun", "ignore"] | None = "rerun",
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool | None = None,
        width: Width = "content",
    ) -> bool:
        r"""Display a download button widget.

        This is useful when you would like to provide a way for your users
        to download a file directly from your app.

        Note that the data to be downloaded is stored in-memory while the
        user is connected, so it's a good idea to keep file sizes under a
        couple hundred megabytes to conserve memory.

        If you want to prevent your app from rerunning when a user clicks the
        download button, wrap the download button in a `fragment
        <https://docs.streamlit.io/develop/concepts/architecture/fragments>`_.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        data : str, bytes, or file
            The contents of the file to be downloaded.

            To prevent unncecessary recomputation, use caching when converting
            your data for download. For more information, see the Example 1
            below.

        file_name: str
            An optional string to use as the name of the file to be downloaded,
            such as ``"my_file.csv"``. If not specified, the name will be
            automatically generated.

        mime : str or None
            The MIME type of the data. If this is ``None`` (default), Streamlit
            sets the MIME type depending on the value of ``data`` as follows:

            - If ``data`` is a string or textual file (i.e. ``str`` or
              ``io.TextIOWrapper`` object), Streamlit uses the "text/plain"
              MIME type.
            - If ``data`` is a binary file or bytes (i.e. ``bytes``,
              ``io.BytesIO``, ``io.BufferedReader``, or ``io.RawIOBase``
              object), Streamlit uses the "application/octet-stream" MIME type.

            For more information about MIME types, see
            https://www.iana.org/assignments/media-types/media-types.xhtml.

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        help : str or None
            A tooltip that gets displayed when the button is hovered over. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        on_click : callable, "rerun", "ignore", or None
            How the button should respond to user interaction. This controls
            whether or not the button triggers a rerun and if a callback
            function is called. This can be one of the following values:

            - ``"rerun"`` (default): The user downloads the file and the app
              reruns. No callback function is called.
            - ``"ignore"``: The user downloads the file and the app doesn't
              rerun. No callback function is called.
            - A ``callable``: The user downloads the file and app reruns. The
              callable is called before the rest of the app.
            - ``None``: This is same as ``on_click="rerun"``. This value exists
              for backwards compatibility and shouldn't be used.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        type : "primary", "secondary", or "tertiary"
            An optional string that specifies the button type. This can be one
            of the following:

            - ``"primary"``: The button's background is the app's primary color
              for additional emphasis.
            - ``"secondary"`` (default): The button's background coordinates
              with the app's background color for normal emphasis.
            - ``"tertiary"``: The button is plain text without a border or
              background for subtlety.

        icon : str or None
            An optional emoji or icon to display next to the button label. If ``icon``
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

        disabled : bool
            An optional boolean that disables the download button if set to
            ``True``. The default is ``False``.

        use_container_width : bool
            Whether to expand the button's width to fill its parent container.
            If ``use_container_width`` is ``False`` (default), Streamlit sizes
            the button to fit its contents. If ``use_container_width`` is
            ``True``, the width of the button matches its parent container.

            In both cases, if the contents of the button are wider than the
            parent container, the contents will line wrap.

        width : "content", "stretch", or int
            The width of the download button. This can be one of the following:

            - ``"content"`` (default): The width of the button matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the button matches the width of the
              parent container.
            - An integer specifying the width in pixels: The button has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the button matches the width
              of the parent container.

        .. deprecated::
            ``use_container_width`` is deprecated and will be removed in a
            future release. For ``use_container_width=True``, use
            ``width="stretch"``. For ``use_container_width=False``, use
            ``width="content"``.

        Returns
        -------
        bool
            True if the button was clicked on the last run of the app,
            False otherwise.

        Examples
        --------
        **Example 1: Download a dataframe as a CSV file**

        When working with a large dataframe, it's recommended to fetch your
        data with a cached function. When working with a download button, it's
        similarly recommended to convert your data into a downloadable format
        with a cached function. Caching ensures that the app reruns
        efficiently.

        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> @st.cache_data
        >>> def get_data():
        >>>     df = pd.DataFrame(
        ...         np.random.randn(50, 20), columns=("col %d" % i for i in range(20))
        ...     )
        >>>     return df
        >>>
        >>> @st.cache_data
        >>> def convert_for_download(df):
        >>>     return df.to_csv().encode("utf-8")
        >>>
        >>> df = get_data()
        >>> csv = convert_for_download(df)
        >>>
        >>> st.download_button(
        ...     label="Download CSV",
        ...     data=csv,
        ...     file_name="data.csv",
        ...     mime="text/csv",
        ...     icon=":material/download:",
        ... )

        .. output::
           https://doc-download-button-csv.streamlit.app/
           height: 200px

        **Example 2: Download a string as a text file**

        If you pass a string to the ``data`` argument, Streamlit will
        automatically use the "text/plain" MIME type.

        When you have a widget (like a text area) affecting the value of your
        download, it's recommended to use another button to prepare the
        download. In this case, use ``on_click="ignore"`` in your download
        button to prevent the download button from rerunning your app. This
        turns the download button into a frontend-only element that can be
        nested in another button.

        Without a preparation button, a user can type something into the text
        area and immediately click the download button. Because a download is
        initiated concurrently with the app rerun, this can create a race-like
        condition where the user doesn't see the updated data in their
        download.

        .. important::
           Even when you prevent your download button from triggering a rerun,
           another widget with a pending change can still trigger a rerun. For
           example, if a text area has a pending change when a user clicks a
           download button, the text area will trigger a rerun.

        >>> import streamlit as st
        >>>
        >>> message = st.text_area("Message", value="Lorem ipsum.\nStreamlit is cool.")
        >>>
        >>> if st.button("Prepare download"):
        >>>     st.download_button(
        ...         label="Download text",
        ...         data=message,
        ...         file_name="message.txt",
        ...         on_click="ignore",
        ...         type="primary",
        ...         icon=":material/download:",
        ...     )

        .. output::
           https://doc-download-button-text.streamlit.app/
           height: 250px

        **Example 3: Download a file**

        Use a context manager to open and read a local file on your Streamlit
        server. Pass the ``io.BufferedReader`` object directly to ``data``.
        Remember to specify the MIME type if you don't want the default
        type of ``"application/octet-stream"`` for generic binary data. In the
        example below, the MIME type is set to ``"image/png"`` for a PNG file.

        >>> import streamlit as st
        >>>
        >>> with open("flower.png", "rb") as file:
        ...     st.download_button(
        ...         label="Download image",
        ...         data=file,
        ...         file_name="flower.png",
        ...         mime="image/png",
        ...     )

        .. output::
           https://doc-download-button-file.streamlit.app/
           height: 200px

        """
        ctx = get_script_run_ctx()

        if use_container_width is not None:
            width = "stretch" if use_container_width else "content"

        if type not in ["primary", "secondary", "tertiary"]:
            raise StreamlitAPIException(
                'The type argument to st.download_button must be "primary", "secondary", or "tertiary". \n'
                f'The argument passed was "{type}".'
            )

        return self._download_button(
            label=label,
            data=data,
            file_name=file_name,
            mime=mime,
            key=key,
            help=help,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            type=type,
            icon=icon,
            disabled=disabled,
            ctx=ctx,
            width=width,
        )

    @gather_metrics("link_button")
    def link_button(
        self,
        label: str,
        url: str,
        *,
        help: str | None = None,
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool | None = None,
        width: Width = "content",
    ) -> DeltaGenerator:
        r"""Display a link button element.

        When clicked, a new tab will be opened to the specified URL. This will
        create a new session for the user if directed within the app.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        url : str
            The url to be opened on user click

        help : str or None
            A tooltip that gets displayed when the button is hovered over. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        type : "primary", "secondary", or "tertiary"
            An optional string that specifies the button type. This can be one
            of the following:

            - ``"primary"``: The button's background is the app's primary color
              for additional emphasis.
            - ``"secondary"`` (default): The button's background coordinates
              with the app's background color for normal emphasis.
            - ``"tertiary"``: The button is plain text without a border or
              background for subtlety.

        icon : str or None
            An optional emoji or icon to display next to the button label. If ``icon``
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

        disabled : bool
            An optional boolean that disables the link button if set to
            ``True``. The default is ``False``.

        use_container_width : bool
            Whether to expand the button's width to fill its parent container.
            If ``use_container_width`` is ``False`` (default), Streamlit sizes
            the button to fit its contents. If ``use_container_width`` is
            ``True``, the width of the button matches its parent container.

            In both cases, if the contents of the button are wider than the
            parent container, the contents will line wrap.

        width : "content", "stretch", or int
            The width of the link button. This can be one of the following:

            - ``"content"`` (default): The width of the button matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the button matches the width of the
              parent container.
            - An integer specifying the width in pixels: The button has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the button matches the width
              of the parent container.

        .. deprecated::
            ``use_container_width`` is deprecated and will be removed in a
            future release. For ``use_container_width=True``, use
            ``width="stretch"``. For ``use_container_width=False``, use
            ``width="content"``.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> st.link_button("Go to gallery", "https://streamlit.io/gallery")

        .. output::
           https://doc-link-button.streamlit.app/
           height: 200px

        """
        # Checks whether the entered button type is one of the allowed options - either "primary" or "secondary"
        if type not in ["primary", "secondary", "tertiary"]:
            raise StreamlitAPIException(
                'The type argument to st.link_button must be "primary", "secondary", or "tertiary". '
                f'\nThe argument passed was "{type}".'
            )

        if use_container_width is not None:
            width = "stretch" if use_container_width else "content"

        return self._link_button(
            label=label,
            url=url,
            help=help,
            disabled=disabled,
            type=type,
            icon=icon,
            width=width,
        )

    @gather_metrics("page_link")
    def page_link(
        self,
        page: str | Path | StreamlitPage,
        *,
        label: str | None = None,
        icon: str | None = None,
        help: str | None = None,
        disabled: bool = False,
        use_container_width: bool | None = None,
        width: Width = "content",
    ) -> DeltaGenerator:
        r"""Display a link to another page in a multipage app or to an external page.

        If another page in a multipage app is specified, clicking ``st.page_link``
        stops the current page execution and runs the specified page as if the
        user clicked on it in the sidebar navigation.

        If an external page is specified, clicking ``st.page_link`` opens a new
        tab to the specified page. The current script run will continue if not
        complete.

        Parameters
        ----------
        page : str, Path, or StreamlitPage
            The file path (relative to the main script) or a ``StreamlitPage``
            indicating the page to switch to. Alternatively, this can be the
            URL to an external page (must start with "http://" or "https://").

        label : str
            The label for the page link. Labels are required for external pages.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, Links,
            and Images. Images display like icons, with a max height equal to
            the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        icon : str or None
            An optional emoji or icon to display next to the button label. If
            ``icon`` is ``None`` (default), the icon is inferred from the
            ``StreamlitPage`` object or no icon is displayed. If ``icon`` is a
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

        help : str or None
            A tooltip that gets displayed when the link is hovered over. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        disabled : bool
            An optional boolean that disables the page link if set to ``True``.
            The default is ``False``.

        use_container_width : bool
            Whether to expand the link's width to fill its parent container.
            The default is ``True`` for page links in the sidebar and ``False``
            for those in the main app.

        width : "content", "stretch", or int
            The width of the page-link button. This can be one of the following:

            - ``"content"`` (default): The width of the button matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the button matches the width of the
              parent container.
            - An integer specifying the width in pixels: The button has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the button matches the width
              of the parent container.

        .. deprecated::
            ``use_container_width`` is deprecated and will be removed in a
            future release. For ``use_container_width=True``, use
            ``width="stretch"``. For ``use_container_width=False``, use
            ``width="content"``.

        Example
        -------
        Consider the following example given this file structure:

        >>> your-repository/
        >>> ├── pages/
        >>> │   ├── page_1.py
        >>> │   └── page_2.py
        >>> └── your_app.py

        >>> import streamlit as st
        >>>
        >>> st.page_link("your_app.py", label="Home", icon="🏠")
        >>> st.page_link("pages/page_1.py", label="Page 1", icon="1️⃣")
        >>> st.page_link("pages/page_2.py", label="Page 2", icon="2️⃣", disabled=True)
        >>> st.page_link("http://www.google.com", label="Google", icon="🌎")

        The default navigation is shown here for comparison, but you can hide
        the default navigation using the |client.showSidebarNavigation|_
        configuration option. This allows you to create custom, dynamic
        navigation menus for your apps!

        .. |client.showSidebarNavigation| replace:: ``client.showSidebarNavigation``
        .. _client.showSidebarNavigation: https://docs.streamlit.io/develop/api-reference/configuration/config.toml#client

        .. output ::
            https://doc-page-link.streamlit.app/
            height: 350px

        """
        if use_container_width is not None:
            width = "stretch" if use_container_width else "content"

        if in_sidebar(self.dg):
            # Sidebar page links should always be stretch width.
            width = "stretch"

        return self._page_link(
            page=page,
            label=label,
            icon=icon,
            help=help,
            disabled=disabled,
            width=width,
        )

    def _download_button(
        self,
        label: str,
        data: DownloadButtonDataType,
        file_name: str | None = None,
        mime: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_click: WidgetCallback | Literal["rerun", "ignore"] | None = "rerun",
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        ctx: ScriptRunContext | None = None,
        width: Width = "content",
    ) -> bool:
        key = to_key(key)

        on_click_callback: WidgetCallback | None = (
            None
            if on_click is None or on_click in {"ignore", "rerun"}
            else cast("WidgetCallback", on_click)
        )

        check_widget_policies(
            self.dg,
            key,
            on_change=on_click_callback,
            default_value=None,
            writes_allowed=False,
        )

        element_id = compute_and_register_element_id(
            "download_button",
            user_key=key,
            # download_button is not allowed to be used in a form.
            form_id=None,
            dg=self.dg,
            label=label,
            icon=icon,
            file_name=file_name,
            mime=mime,
            help=help,
            type=type,
            width=width,
        )

        if is_in_form(self.dg):
            raise StreamlitAPIException(
                f"`st.download_button()` can't be used in an `st.form()`.{FORM_DOCS_INFO}"
            )

        download_button_proto = DownloadButtonProto()
        download_button_proto.id = element_id
        download_button_proto.label = label
        download_button_proto.default = False
        download_button_proto.type = type
        marshall_file(
            self.dg._get_delta_path_str(), data, download_button_proto, mime, file_name
        )
        download_button_proto.disabled = disabled

        if help is not None:
            download_button_proto.help = dedent(help)

        if icon is not None:
            download_button_proto.icon = validate_icon_or_emoji(icon)

        if on_click == "ignore":
            download_button_proto.ignore_rerun = True
        else:
            download_button_proto.ignore_rerun = False

        serde = ButtonSerde()

        button_state = register_widget(
            download_button_proto.id,
            on_change_handler=on_click_callback,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="trigger_value",
        )

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)
        self.dg._enqueue(
            "download_button", download_button_proto, layout_config=layout_config
        )
        return button_state.value

    def _link_button(
        self,
        label: str,
        url: str,
        help: str | None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        width: Width = "content",
    ) -> DeltaGenerator:
        link_button_proto = LinkButtonProto()
        link_button_proto.label = label
        link_button_proto.url = url
        link_button_proto.type = type
        link_button_proto.disabled = disabled

        if help is not None:
            link_button_proto.help = dedent(help)

        if icon is not None:
            link_button_proto.icon = validate_icon_or_emoji(icon)

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)
        return self.dg._enqueue(
            "link_button", link_button_proto, layout_config=layout_config
        )

    def _page_link(
        self,
        page: str | Path | StreamlitPage,
        *,  # keyword-only arguments:
        label: str | None = None,
        icon: str | None = None,
        help: str | None = None,
        disabled: bool = False,
        width: Width = "content",
    ) -> DeltaGenerator:
        page_link_proto = PageLinkProto()
        validate_width(width, allow_content=True)

        ctx = get_script_run_ctx()
        if not ctx:
            layout_config = LayoutConfig(width=width)
            return self.dg._enqueue(
                "page_link", page_link_proto, layout_config=layout_config
            )

        page_link_proto.disabled = disabled

        if label is not None:
            page_link_proto.label = label

        if icon is not None:
            page_link_proto.icon = validate_icon_or_emoji(icon)

        if help is not None:
            page_link_proto.help = dedent(help)

        if isinstance(page, StreamlitPage):
            page_link_proto.page_script_hash = page._script_hash
            page_link_proto.page = page.url_path
            if label is None:
                page_link_proto.label = page.title
            if icon is None:
                page_link_proto.icon = page.icon
                # Here the StreamlitPage's icon is already validated
                # (using validate_icon_or_emoji) during its initialization
        else:
            # Convert Path to string if necessary
            if isinstance(page, Path):
                page = str(page)

            # Handle external links:
            if is_url(page):
                if label is None or label == "":
                    raise StreamlitMissingPageLabelError()
                page_link_proto.page = page
                page_link_proto.external = True
                layout_config = LayoutConfig(width=width)
                return self.dg._enqueue(
                    "page_link", page_link_proto, layout_config=layout_config
                )

            ctx_main_script = ""
            all_app_pages = {}
            ctx_main_script = ctx.main_script_path
            all_app_pages = ctx.pages_manager.get_pages()

            main_script_directory = get_main_script_directory(ctx_main_script)
            requested_page = os.path.realpath(
                normalize_path_join(main_script_directory, page)
            )

            # Handle retrieving the page_script_hash & page
            for page_data in all_app_pages.values():
                full_path = page_data["script_path"]
                page_name = page_data["page_name"]
                url_pathname = page_data["url_pathname"]
                if requested_page == full_path:
                    if label is None:
                        page_link_proto.label = page_name
                    page_link_proto.page_script_hash = page_data["page_script_hash"]
                    page_link_proto.page = url_pathname
                    break

            if page_link_proto.page_script_hash == "":
                raise StreamlitPageNotFoundError(
                    page=page,
                    main_script_directory=main_script_directory,
                    uses_pages_directory=bool(PagesManager.uses_pages_directory),
                )

        layout_config = LayoutConfig(width=width)
        return self.dg._enqueue(
            "page_link", page_link_proto, layout_config=layout_config
        )

    def _button(
        self,
        label: str,
        key: str | None,
        help: str | None,
        is_form_submitter: bool,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        ctx: ScriptRunContext | None = None,
        width: Width = "content",
    ) -> bool:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_click,
            default_value=None,
            writes_allowed=False,
            enable_check_callback_rules=not is_form_submitter,
        )

        # Only the form submitter button needs a form ID at the moment.
        form_id = current_form_id(self.dg) if is_form_submitter else ""
        element_id = compute_and_register_element_id(
            "button",
            user_key=key,
            # Only the
            form_id=form_id,
            dg=self.dg,
            label=label,
            icon=icon,
            help=help,
            is_form_submitter=is_form_submitter,
            type=type,
            width=width,
        )

        # It doesn't make sense to create a button inside a form (except
        # for the "Form Submitter" button that's automatically created in
        # every form). We throw an error to warn the user about this.
        # We omit this check for scripts running outside streamlit, because
        # they will have no script_run_ctx.
        if runtime.exists():
            if is_in_form(self.dg) and not is_form_submitter:
                raise StreamlitAPIException(
                    f"`st.button()` can't be used in an `st.form()`.{FORM_DOCS_INFO}"
                )
            if not is_in_form(self.dg) and is_form_submitter:
                raise StreamlitAPIException(
                    f"`st.form_submit_button()` must be used inside an `st.form()`.{FORM_DOCS_INFO}"
                )

        button_proto = ButtonProto()
        button_proto.id = element_id
        button_proto.label = label
        button_proto.default = False
        button_proto.is_form_submitter = is_form_submitter
        button_proto.form_id = form_id
        button_proto.type = type
        button_proto.disabled = disabled

        if help is not None:
            button_proto.help = dedent(help)

        if icon is not None:
            button_proto.icon = validate_icon_or_emoji(icon)

        serde = ButtonSerde()

        button_state = register_widget(
            button_proto.id,
            on_change_handler=on_click,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="trigger_value",
        )

        if ctx:
            save_for_app_testing(ctx, element_id, button_state.value)

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)
        self.dg._enqueue("button", button_proto, layout_config=layout_config)

        return button_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall_file(
    coordinates: str,
    data: DownloadButtonDataType,
    proto_download_button: DownloadButtonProto,
    mimetype: str | None,
    file_name: str | None = None,
) -> None:
    data_as_bytes: bytes
    if isinstance(data, str):
        data_as_bytes = data.encode()
        mimetype = mimetype or "text/plain"
    elif isinstance(data, io.TextIOWrapper):
        string_data = data.read()
        data_as_bytes = string_data.encode()
        mimetype = mimetype or "text/plain"
    # Assume bytes; try methods until we run out.
    elif isinstance(data, bytes):
        data_as_bytes = data
        mimetype = mimetype or "application/octet-stream"
    elif isinstance(data, io.BytesIO):
        data.seek(0)
        data_as_bytes = data.getvalue()
        mimetype = mimetype or "application/octet-stream"
    elif isinstance(data, io.BufferedReader):
        data.seek(0)
        data_as_bytes = data.read()
        mimetype = mimetype or "application/octet-stream"
    elif isinstance(data, io.RawIOBase):
        data.seek(0)
        data_as_bytes = data.read() or b""
        mimetype = mimetype or "application/octet-stream"
    else:
        raise StreamlitAPIException(f"Invalid binary data format: {type(data)}")

    if runtime.exists():
        file_url = runtime.get_instance().media_file_mgr.add(
            data_as_bytes,
            mimetype,
            coordinates,
            file_name=file_name,
            is_for_static_download=True,
        )
    else:
        # When running in "raw mode", we can't access the MediaFileManager.
        file_url = ""

    proto_download_button.url = file_url
