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
import os
from dataclasses import dataclass
from textwrap import dedent
from typing import (
    TYPE_CHECKING,
    BinaryIO,
    Final,
    Iterable,
    Literal,
    Mapping,
    TextIO,
    Union,
    cast,
)

from typing_extensions import TypeAlias

from streamlit import runtime
from streamlit.elements.lib.form_utils import current_form_id, is_in_form
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
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.state import (
    WidgetArgs,
    WidgetCallback,
    WidgetKwargs,
    register_widget,
)
from streamlit.runtime.state.query_params import QueryParams
from streamlit.string_util import validate_icon_or_emoji
from streamlit.url_util import is_url

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

    def deserialize(self, ui_value: bool | None, widget_id: str = "") -> bool:
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
        type: Literal["primary", "secondary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
    ) -> bool:
        r"""Display a button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, and
            Links.

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
        help : str
            An optional tooltip that gets displayed when the button is
            hovered over.

        on_click : callable
            An optional callback invoked when this button is clicked.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        type : "secondary" or "primary"
            An optional string that specifies the button type. Can be "primary" for a
            button with additional emphasis or "secondary" for a normal button. Defaults
            to "secondary".

        icon : str or None
            An optional emoji or icon to display next to the button label. If ``icon``
            is ``None`` (default), no icon is displayed. If ``icon`` is a
            string, the following options are valid:

            * A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            * An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

        disabled : bool
            An optional boolean, which disables the button if set to True. The
            default is False.

        use_container_width : bool
            Whether to expand the button's width to fill its parent container.
            If ``use_container_width`` is ``False`` (default), Streamlit sizes
            the button to fit its contents. If ``use_container_width`` is
            ``True``, the width of the button matches its parent container.

            In both cases, if the contents of the button are wider than the
            parent container, the contents will line wrap.

        Returns
        -------
        bool
            True if the button was clicked on the last run of the app,
            False otherwise.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.button("Reset", type="primary")
        >>> if st.button("Say hello"):
        ...     st.write("Why hello there")
        ... else:
        ...     st.write("Goodbye")

        .. output::
           https://doc-buton.streamlit.app/
           height: 220px

        Although you can add icons to your buttons through Markdown, the
        ``icon`` parameter is a convenient and consistent alternative.

        >>> import streamlit as st
        >>>
        >>> left, middle, right = st.columns(3)
        >>> if left.button("Plain button", use_container_width=True):
        ...     left.markdown("You clicked the plain button.")
        >>> if middle.button("Emoji button", icon="😃", use_container_width=True):
        ...     middle.markdown("You clicked the emoji button.")
        >>> if right.button("Material button", icon=":material/mood:", use_container_width=True):
        ...     right.markdown("You clicked the Material button.")

        .. output::
           https://doc-button-icons.streamlit.app/
           height: 220px

        """
        key = to_key(key)
        ctx = get_script_run_ctx()

        # Checks whether the entered button type is one of the allowed options - either "primary" or "secondary"
        if type not in ["primary", "secondary"]:
            raise StreamlitAPIException(
                'The type argument to st.button must be "primary" or "secondary". \n'
                f'The argument passed was "{type}".'
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
            use_container_width=use_container_width,
            ctx=ctx,
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
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
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
            following types: Bold, Italics, Strikethroughs, Inline Code, and
            Links.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        data : str or bytes or file
            The contents of the file to be downloaded. See example below for
            caching techniques to avoid recomputing this data unnecessarily.

        file_name: str
            An optional string to use as the name of the file to be downloaded,
            such as 'my_file.csv'. If not specified, the name will be
            automatically generated.

        mime : str or None
            The MIME type of the data. If None, defaults to "text/plain"
            (if data is of type *str* or is a textual *file*) or
            "application/octet-stream" (if data is of type *bytes* or is a
            binary *file*).

        key : str or int
            An optional string or integer to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. No two widgets may have the same key.

        help : str
            An optional tooltip that gets displayed when the button is
            hovered over.

        on_click : callable
            An optional callback invoked when this button is clicked.

        args : tuple
            An optional tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        type : "secondary" or "primary"
            An optional string that specifies the button type. Can be "primary" for a
            button with additional emphasis or "secondary" for a normal button. Defaults
            to "secondary".

        icon : str or None
            An optional emoji or icon to display next to the button label. If ``icon``
            is ``None`` (default), no icon is displayed. If ``icon`` is a
            string, the following options are valid:

            * A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            * An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

        disabled : bool
            An optional boolean, which disables the download button if set to
            True. The default is False.

        use_container_width : bool
            Whether to expand the button's width to fill its parent container.
            If ``use_container_width`` is ``False`` (default), Streamlit sizes
            the button to fit its contents. If ``use_container_width`` is
            ``True``, the width of the button matches its parent container.

            In both cases, if the contents of the button are wider than the
            parent container, the contents will line wrap.

        Returns
        -------
        bool
            True if the button was clicked on the last run of the app,
            False otherwise.

        Examples
        --------
        Download a large DataFrame as a CSV:

        >>> import streamlit as st
        >>>
        >>> @st.cache_data
        ... def convert_df(df):
        ...     # IMPORTANT: Cache the conversion to prevent computation on every rerun
        ...     return df.to_csv().encode("utf-8")
        >>>
        >>> csv = convert_df(my_large_df)
        >>>
        >>> st.download_button(
        ...     label="Download data as CSV",
        ...     data=csv,
        ...     file_name="large_df.csv",
        ...     mime="text/csv",
        ... )

        Download a string as a file:

        >>> import streamlit as st
        >>>
        >>> text_contents = '''This is some text'''
        >>> st.download_button("Download some text", text_contents)

        Download a binary file:

        >>> import streamlit as st
        >>>
        >>> binary_contents = b"example content"
        >>> # Defaults to "application/octet-stream"
        >>> st.download_button("Download binary file", binary_contents)

        Download an image:

        >>> import streamlit as st
        >>>
        >>> with open("flower.png", "rb") as file:
        ...     btn = st.download_button(
        ...         label="Download image",
        ...         data=file,
        ...         file_name="flower.png",
        ...         mime="image/png",
        ...     )

        .. output::
           https://doc-download-buton.streamlit.app/
           height: 335px

        """
        ctx = get_script_run_ctx()

        if type not in ["primary", "secondary"]:
            raise StreamlitAPIException(
                'The type argument to st.button must be "primary" or "secondary". \n'
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
            use_container_width=use_container_width,
            ctx=ctx,
        )

    @gather_metrics("link_button")
    def link_button(
        self,
        label: str,
        url: str,
        *,
        help: str | None = None,
        type: Literal["primary", "secondary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
    ) -> DeltaGenerator:
        r"""Display a link button element.

        When clicked, a new tab will be opened to the specified URL. This will
        create a new session for the user if directed within the app.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, and
            Links.

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

        help : str
            An optional tooltip that gets displayed when the button is
            hovered over.

        type : "secondary" or "primary"
            An optional string that specifies the button type. Can be "primary" for a
            button with additional emphasis or "secondary" for a normal button. Defaults
            to "secondary".

        icon : str or None
            An optional emoji or icon to display next to the button label. If ``icon``
            is ``None`` (default), no icon is displayed. If ``icon`` is a
            string, the following options are valid:

            * A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            * An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

        disabled : bool
            An optional boolean, which disables the link button if set to
            True. The default is False.

        use_container_width : bool
            Whether to expand the button's width to fill its parent container.
            If ``use_container_width`` is ``False`` (default), Streamlit sizes
            the button to fit its contents. If ``use_container_width`` is
            ``True``, the width of the button matches its parent container.

            In both cases, if the contents of the button are wider than the
            parent container, the contents will line wrap.

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
        if type not in ["primary", "secondary"]:
            raise StreamlitAPIException(
                'The type argument to st.link_button must be "primary" or "secondary". '
                f'\nThe argument passed was "{type}".'
            )

        return self._link_button(
            label=label,
            url=url,
            help=help,
            disabled=disabled,
            type=type,
            icon=icon,
            use_container_width=use_container_width,
        )

    @gather_metrics("page_link")
    def page_link(
        self,
        page: str | StreamlitPage,
        *,
        label: str | None = None,
        icon: str | None = None,
        help: str | None = None,
        disabled: bool = False,
        use_container_width: bool | None = None,
        query_params: Mapping[str, str | Iterable[str]] | None = None,
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
        page : str or st.Page
            The file path (relative to the main script) or an st.Page indicating
            the page to switch to. Alternatively, this can be the URL to an
            external page (must start with "http://" or "https://").

        label : str
            The label for the page link. Labels are required for external pages.
            The label can optionally contain GitHub-flavored Markdown of the
            following types: Bold, Italics, Strikethroughs, Inline Code, and
            Links.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        icon : str or None
            An optional emoji or icon to display next to the button label. If ``icon``
            is ``None`` (default), no icon is displayed. If ``icon`` is a
            string, the following options are valid:

            * A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            * An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

        help : str
            An optional tooltip that gets displayed when the link is
            hovered over.

        disabled : bool
            An optional boolean, which disables the page link if set to
            ``True``. The default is ``False``.

        use_container_width : bool
            Whether to expand the link's width to fill its parent container.
            The default is ``True`` for page links in the sidebar and ``False``
            for those in the main app.
        query_params : dict[str, str]
            An optional dictionary (or other mapping) which is used to populate
            the query parameters (the portion of the url after "?") on the switched-to
            page. If not provided, all parameters are cleared when the page is changed.
            If `st.query_params` itself is provided, all parameters will be maintained
            on the new page.

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

        return self._page_link(
            page=page,
            label=label,
            icon=icon,
            help=help,
            disabled=disabled,
            use_container_width=use_container_width,
            query_params=query_params,
        )

    def _download_button(
        self,
        label: str,
        data: DownloadButtonDataType,
        file_name: str | None = None,
        mime: str | None = None,
        key: Key | None = None,
        help: str | None = None,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
        ctx: ScriptRunContext | None = None,
    ) -> bool:
        key = to_key(key)

        check_widget_policies(
            self.dg,
            key,
            on_click,
            default_value=None,
            writes_allowed=False,
        )

        element_id = compute_and_register_element_id(
            "download_button",
            user_key=key,
            # download_button is not allowed to be used in a form.
            form_id=None,
            label=label,
            icon=icon,
            file_name=file_name,
            mime=mime,
            help=help,
            type=type,
            use_container_width=use_container_width,
        )

        if is_in_form(self.dg):
            raise StreamlitAPIException(
                f"`st.download_button()` can't be used in an `st.form()`.{FORM_DOCS_INFO}"
            )

        download_button_proto = DownloadButtonProto()
        download_button_proto.id = element_id
        download_button_proto.use_container_width = use_container_width
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

        serde = ButtonSerde()

        button_state = register_widget(
            download_button_proto.id,
            on_change_handler=on_click,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="trigger_value",
        )

        self.dg._enqueue("download_button", download_button_proto)
        return button_state.value

    def _link_button(
        self,
        label: str,
        url: str,
        help: str | None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
    ) -> DeltaGenerator:
        link_button_proto = LinkButtonProto()
        link_button_proto.label = label
        link_button_proto.url = url
        link_button_proto.type = type
        link_button_proto.use_container_width = use_container_width
        link_button_proto.disabled = disabled

        if help is not None:
            link_button_proto.help = dedent(help)

        if icon is not None:
            link_button_proto.icon = validate_icon_or_emoji(icon)

        return self.dg._enqueue("link_button", link_button_proto)

    def _page_link(
        self,
        page: str | StreamlitPage,
        *,  # keyword-only arguments:
        label: str | None = None,
        icon: str | None = None,
        help: str | None = None,
        disabled: bool = False,
        use_container_width: bool | None = None,
        query_params: Mapping[str, str | Iterable[str]] | None = None,
    ) -> DeltaGenerator:
        page_link_proto = PageLinkProto()
        page_link_proto.disabled = disabled

        if label is not None:
            page_link_proto.label = label

        if icon is not None:
            page_link_proto.icon = validate_icon_or_emoji(icon)

        if help is not None:
            page_link_proto.help = dedent(help)

        if use_container_width is not None:
            page_link_proto.use_container_width = use_container_width

        if isinstance(page, StreamlitPage):
            page_link_proto.page_script_hash = page._script_hash
            page_link_proto.page = page.url_path
            if label is None:
                page_link_proto.label = page.title
        else:
            # Handle external links:
            if is_url(page):
                if query_params is not None:
                    raise StreamlitAPIException(
                        "The query_params argument cannot be used with st.page_link when the link provided is a raw URL."
                    )
                if label is None or label == "":
                    raise StreamlitMissingPageLabelError()
                else:
                    page_link_proto.page = page
                    page_link_proto.external = True
                    return self.dg._enqueue("page_link", page_link_proto)

            ctx = get_script_run_ctx()
            ctx_main_script = ""
            all_app_pages = {}
            if ctx:
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
                if requested_page == full_path:
                    if label is None:
                        page_link_proto.label = page_name.replace("_", " ")
                    page_link_proto.page_script_hash = page_data["page_script_hash"]
                    page_link_proto.page = page_name
                    break

            if page_link_proto.page_script_hash == "":
                is_mpa_v2 = (
                    ctx is not None
                    and ctx.pages_manager is not None
                    and ctx.pages_manager.mpa_version == 2
                )

                raise StreamlitPageNotFoundError(
                    is_mpa_v2=is_mpa_v2,
                    page=page,
                    main_script_directory=main_script_directory,
                )

        if query_params is not None:
            if not hasattr(query_params, "get_all"):
                query_params_internal: QueryParams = QueryParams()
                # turn off sending forward messages for THIS QueryParams
                query_params_internal._disable_forward_msg = True
                query_params_internal.from_dict(query_params)
            else:
                query_params_internal = cast(QueryParams, query_params)
            page_link_proto.query_string = query_params_internal.to_string()

        return self.dg._enqueue("page_link", page_link_proto)

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
        type: Literal["primary", "secondary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
        ctx: ScriptRunContext | None = None,
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
            label=label,
            icon=icon,
            help=help,
            is_form_submitter=is_form_submitter,
            type=type,
            use_container_width=use_container_width,
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
            elif not is_in_form(self.dg) and is_form_submitter:
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
        button_proto.use_container_width = use_container_width
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
        self.dg._enqueue("button", button_proto)

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
        raise RuntimeError("Invalid binary data format: %s" % type(data))

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


# def update_query_params_proto(proto: PageLinkProto, qp: Mapping[str, Iterable[str]]):
#     """Updates the query_params PageLinkProto message iteratively, since it cannot be directly assigned."""
#     for key, values in qp.items():
#         proto.query_params[key].values.extend(values)
