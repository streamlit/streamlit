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

"""Allows us to create and absorb changes (aka Deltas) to elements."""

from __future__ import annotations

import sys
from collections.abc import Iterable
from copy import deepcopy
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Final,
    Literal,
    NoReturn,
    TypeVar,
    cast,
)

from typing_extensions import TypeAlias

from streamlit import (
    cli_util,
    config,
    cursor,
    env_util,
    logger,
    runtime,
    util,
)
from streamlit.delta_generator_singletons import (
    context_dg_stack,
    get_last_dg_added_to_context_stack,
)
from streamlit.elements.alert import AlertMixin
from streamlit.elements.arrow import ArrowMixin
from streamlit.elements.balloons import BalloonsMixin
from streamlit.elements.bokeh_chart import BokehMixin
from streamlit.elements.code import CodeMixin
from streamlit.elements.deck_gl_json_chart import PydeckMixin
from streamlit.elements.doc_string import HelpMixin
from streamlit.elements.empty import EmptyMixin
from streamlit.elements.exception import ExceptionMixin
from streamlit.elements.form import FormMixin
from streamlit.elements.graphviz_chart import GraphvizMixin
from streamlit.elements.heading import HeadingMixin
from streamlit.elements.html import HtmlMixin
from streamlit.elements.iframe import IframeMixin
from streamlit.elements.image import ImageMixin
from streamlit.elements.json import JsonMixin
from streamlit.elements.layouts import LayoutsMixin
from streamlit.elements.lib.form_utils import FormData, current_form_id
from streamlit.elements.lib.layout_utils import (
    get_height_config,
    get_width_config,
)
from streamlit.elements.map import MapMixin
from streamlit.elements.markdown import MarkdownMixin
from streamlit.elements.media import MediaMixin
from streamlit.elements.metric import MetricMixin
from streamlit.elements.plotly_chart import PlotlyMixin
from streamlit.elements.progress import ProgressMixin
from streamlit.elements.pyplot import PyplotMixin
from streamlit.elements.snow import SnowMixin
from streamlit.elements.text import TextMixin
from streamlit.elements.toast import ToastMixin
from streamlit.elements.vega_charts import VegaChartsMixin
from streamlit.elements.widgets.audio_input import AudioInputMixin
from streamlit.elements.widgets.button import ButtonMixin
from streamlit.elements.widgets.button_group import ButtonGroupMixin
from streamlit.elements.widgets.camera_input import CameraInputMixin
from streamlit.elements.widgets.chat import ChatMixin
from streamlit.elements.widgets.checkbox import CheckboxMixin
from streamlit.elements.widgets.color_picker import ColorPickerMixin
from streamlit.elements.widgets.data_editor import DataEditorMixin
from streamlit.elements.widgets.file_uploader import FileUploaderMixin
from streamlit.elements.widgets.multiselect import MultiSelectMixin
from streamlit.elements.widgets.number_input import NumberInputMixin
from streamlit.elements.widgets.radio import RadioMixin
from streamlit.elements.widgets.select_slider import SelectSliderMixin
from streamlit.elements.widgets.selectbox import SelectboxMixin
from streamlit.elements.widgets.slider import SliderMixin
from streamlit.elements.widgets.text_widgets import TextWidgetsMixin
from streamlit.elements.widgets.time_widgets import TimeWidgetsMixin
from streamlit.elements.write import WriteMixin
from streamlit.errors import StreamlitAPIException
from streamlit.proto import Block_pb2, ForwardMsg_pb2
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime import caching
from streamlit.runtime.scriptrunner import enqueue_message as _enqueue_message
from streamlit.runtime.scriptrunner import get_script_run_ctx

if TYPE_CHECKING:
    from types import TracebackType

    from google.protobuf.message import Message

    from streamlit.cursor import Cursor
    from streamlit.elements.lib.built_in_chart_utils import AddRowsMetadata
    from streamlit.elements.lib.layout_utils import LayoutConfig

MAX_DELTA_BYTES: Final[int] = 14 * 1024 * 1024  # 14MB

Value = TypeVar("Value")

# Type aliases for Ancestor Block Types
BlockType: TypeAlias = str
AncestorBlockTypes: TypeAlias = Iterable[BlockType]


_use_warning_has_been_displayed: bool = False


def _maybe_print_use_warning() -> None:
    """Print a warning if Streamlit is imported but not being run with `streamlit run`.
    The warning is printed only once, and is printed using the root logger.
    """
    global _use_warning_has_been_displayed  # noqa: PLW0603

    if not _use_warning_has_been_displayed:
        _use_warning_has_been_displayed = True

        warning = cli_util.style_for_cli("Warning:", bold=True, fg="yellow")

        if env_util.is_repl():
            logger.get_logger("root").warning(
                f"\n  {warning} to view a Streamlit app on a browser, use Streamlit in "
                "a file and\n  run it with the following command:\n\n    streamlit run "
                "[FILE_NAME] [ARGUMENTS]"
            )

        elif not runtime.exists() and config.get_option(
            "global.showWarningOnDirectExecution"
        ):
            script_name = sys.argv[0]

            logger.get_logger("root").warning(
                f"\n  {warning} to view this Streamlit app on a browser, run it with "
                f"the following\n  command:\n\n    streamlit run {script_name} "
                "[ARGUMENTS]"
            )


def _maybe_print_fragment_callback_warning() -> None:
    """Print a warning if elements are being modified during a fragment callback."""
    ctx = get_script_run_ctx()
    if ctx and getattr(ctx, "in_fragment_callback", False):
        warning = cli_util.style_for_cli("Warning:", bold=True, fg="yellow")

        logger.get_logger("root").warning(
            f"\n  {warning} A fragment rerun was triggered with a callback that displays one or more elements. "
            "During a fragment rerun, within a callback, displaying elements is not officially supported because "
            "those elements will replace the existing elements at the top of your app."
        )


class DeltaGenerator(
    AlertMixin,
    AudioInputMixin,
    BalloonsMixin,
    BokehMixin,
    ButtonMixin,
    ButtonGroupMixin,
    CameraInputMixin,
    ChatMixin,
    CheckboxMixin,
    CodeMixin,
    ColorPickerMixin,
    EmptyMixin,
    ExceptionMixin,
    FileUploaderMixin,
    FormMixin,
    GraphvizMixin,
    HeadingMixin,
    HelpMixin,
    HtmlMixin,
    IframeMixin,
    ImageMixin,
    LayoutsMixin,
    MarkdownMixin,
    MapMixin,
    MediaMixin,
    MetricMixin,
    MultiSelectMixin,
    NumberInputMixin,
    PlotlyMixin,
    ProgressMixin,
    PydeckMixin,
    PyplotMixin,
    RadioMixin,
    SelectboxMixin,
    SelectSliderMixin,
    SliderMixin,
    SnowMixin,
    JsonMixin,
    TextMixin,
    TextWidgetsMixin,
    TimeWidgetsMixin,
    ToastMixin,
    WriteMixin,
    ArrowMixin,
    VegaChartsMixin,
    DataEditorMixin,
):
    """Creator of Delta protobuf messages.

    Parameters
    ----------
    root_container: BlockPath_pb2.BlockPath.ContainerValue or None
      The root container for this DeltaGenerator. If None, this is a null
      DeltaGenerator which doesn't print to the app at all (useful for
      testing).

    cursor: cursor.Cursor or None
      This is either:
      - None: if this is the running DeltaGenerator for a top-level
        container (MAIN or SIDEBAR)
      - RunningCursor: if this is the running DeltaGenerator for a
        non-top-level container (created with dg.container())
      - LockedCursor: if this is a locked DeltaGenerator returned by some
        other DeltaGenerator method. E.g. the dg returned in dg =
        st.text("foo").

    parent: DeltaGenerator
      To support the `with dg` notation, DGs are arranged as a tree. Each DG
      remembers its own parent, and the root of the tree is the main DG.

    block_type: None or "vertical" or "horizontal" or "column" or "expandable"
      If this is a block DG, we track its type to prevent nested columns/expanders

    """

    # The pydoc below is for user consumption, so it doesn't talk about
    # DeltaGenerator constructor parameters (which users should never use). For
    # those, see above.
    def __init__(
        self,
        root_container: int | None = RootContainer.MAIN,
        cursor: Cursor | None = None,
        parent: DeltaGenerator | None = None,
        block_type: str | None = None,
    ) -> None:
        """Inserts or updates elements in Streamlit apps.

        As a user, you should never initialize this object by hand. Instead,
        DeltaGenerator objects are initialized for you in two places:

        1) When you call `dg = st.foo()` for some method "foo", sometimes `dg`
        is a DeltaGenerator object. You can call methods on the `dg` object to
        update the element `foo` that appears in the Streamlit app.

        2) This is an internal detail, but `st.sidebar` itself is a
        DeltaGenerator. That's why you can call `st.sidebar.foo()` to place
        an element `foo` inside the sidebar.

        """
        # Sanity check our Container + Cursor, to ensure that our Cursor
        # is using the same Container that we are.
        if (
            root_container is not None
            and cursor is not None
            and root_container != cursor.root_container
        ):
            raise RuntimeError(
                "DeltaGenerator root_container and cursor.root_container must be the same"
            )

        # Whether this DeltaGenerator is nested in the main area or sidebar.
        # No relation to `st.container()`.
        self._root_container = root_container

        # NOTE: You should never use this directly! Instead, use self._cursor,
        # which is a computed property that fetches the right cursor.
        self._provided_cursor = cursor

        self._parent = parent
        self._block_type = block_type

        # If this an `st.form` block, this will get filled in.
        self._form_data: FormData | None = None

        # Change the module of all mixin'ed functions to be st.delta_generator,
        # instead of the original module (e.g. st.elements.markdown)
        for mixin in self.__class__.__bases__:
            for func in mixin.__dict__.values():
                if callable(func):
                    func.__module__ = self.__module__

    def __repr__(self) -> str:
        return util.repr_(self)

    def __enter__(self) -> None:
        # with block started
        context_dg_stack.set((*context_dg_stack.get(), self))

    def __exit__(
        self,
        typ: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> Literal[False]:
        # with block ended

        context_dg_stack.set(context_dg_stack.get()[:-1])

        # Re-raise any exceptions
        return False

    @property
    def _active_dg(self) -> DeltaGenerator:
        """Return the DeltaGenerator that's currently 'active'.
        If we are the main DeltaGenerator, and are inside a `with` block that
        creates a container, our active_dg is that container. Otherwise,
        our active_dg is self.
        """
        if self == self._main_dg:
            # We're being invoked via an `st.foo` pattern - use the current
            # `with` dg (aka the top of the stack).
            last_context_stack_dg = get_last_dg_added_to_context_stack()
            if last_context_stack_dg is not None:
                return last_context_stack_dg

        # We're being invoked via an `st.sidebar.foo` pattern - ignore the
        # current `with` dg.
        return self

    @property
    def _main_dg(self) -> DeltaGenerator:
        """Return this DeltaGenerator's root - that is, the top-level ancestor
        DeltaGenerator that we belong to (this generally means the st._main
        DeltaGenerator).
        """
        return self._parent._main_dg if self._parent else self

    def __getattr__(self, name: str) -> Callable[..., NoReturn]:
        import streamlit as st

        streamlit_methods = [
            method_name for method_name in dir(st) if callable(getattr(st, method_name))
        ]

        def wrapper(*args: Any, **kwargs: Any) -> NoReturn:
            if name in streamlit_methods:
                if self._root_container == RootContainer.SIDEBAR:
                    message = (
                        f"Method `{name}()` does not exist for "
                        f"`st.sidebar`. Did you mean `st.{name}()`?"
                    )
                else:
                    message = (
                        f"Method `{name}()` does not exist for "
                        "`DeltaGenerator` objects. Did you mean "
                        f"`st.{name}()`?"
                    )
            else:
                message = f"`{name}()` is not a valid Streamlit command."

            raise StreamlitAPIException(message)

        return wrapper

    def __deepcopy__(self, _memo: Any) -> DeltaGenerator:
        dg = DeltaGenerator(
            root_container=self._root_container,
            cursor=deepcopy(self._cursor),
            parent=deepcopy(self._parent),
            block_type=self._block_type,
        )
        dg._form_data = deepcopy(self._form_data)
        return dg

    @property
    def _ancestors(self) -> Iterable[DeltaGenerator]:
        current_dg: DeltaGenerator | None = self
        while current_dg is not None:
            yield current_dg
            current_dg = current_dg._parent

    @property
    def _ancestor_block_types(self) -> AncestorBlockTypes:
        """Iterate all the block types used by this DeltaGenerator and all
        its ancestor DeltaGenerators.
        """
        for a in self._ancestors:
            if a._block_type is not None:
                yield a._block_type

    def _count_num_of_parent_columns(
        self, ancestor_block_types: AncestorBlockTypes
    ) -> int:
        return sum(
            1 for ancestor_block in ancestor_block_types if ancestor_block == "column"
        )

    @property
    def _cursor(self) -> Cursor | None:
        """Return our Cursor. This will be None if we're not running in a
        ScriptThread - e.g., if we're running a "bare" script outside of
        Streamlit.
        """
        if self._provided_cursor is None:
            return cursor.get_container_cursor(self._root_container)
        return self._provided_cursor

    @property
    def _is_top_level(self) -> bool:
        return self._provided_cursor is None

    @property
    def id(self) -> str:
        return str(id(self))

    def _get_delta_path_str(self) -> str:
        """Returns the element's delta path as a string like "[0, 2, 3, 1]".

        This uniquely identifies the element's position in the front-end,
        which allows (among other potential uses) the MediaFileManager to maintain
        session-specific maps of MediaFile objects placed with their "coordinates".

        This way, users can (say) use st.image with a stream of different images,
        and Streamlit will expire the older images and replace them in place.
        """
        # Operate on the active DeltaGenerator, in case we're in a `with` block.
        dg = self._active_dg
        return str(dg._cursor.delta_path) if dg._cursor is not None else "[]"

    def _enqueue(
        self,
        delta_type: str,
        element_proto: Message,
        add_rows_metadata: AddRowsMetadata | None = None,
        layout_config: LayoutConfig | None = None,
    ) -> DeltaGenerator:
        """Create NewElement delta, fill it, and enqueue it.

        Parameters
        ----------
        delta_type : str
            The name of the streamlit method being called
        element_proto : proto
            The actual proto in the NewElement type e.g. Alert/Button/Slider
        add_rows_metadata : AddRowsMetadata or None
            Metadata for the add_rows method

        Returns
        -------
        DeltaGenerator
            Return a DeltaGenerator that can be used to modify the newly-created
            element.
        """
        # Operate on the active DeltaGenerator, in case we're in a `with` block.
        dg = self._active_dg

        ctx = get_script_run_ctx()
        if ctx and ctx.current_fragment_id and _writes_directly_to_sidebar(dg):
            raise StreamlitAPIException(
                "Calling `st.sidebar` in a function wrapped with `st.fragment` is not "
                "supported. To write elements to the sidebar with a fragment, call your "
                "fragment function inside a `with st.sidebar` context manager."
            )

        # Warn if an element is being changed but the user isn't running the streamlit server.
        _maybe_print_use_warning()
        # Warn if an element is being changed during a fragment callback.
        _maybe_print_fragment_callback_warning()

        # Copy the marshalled proto into the overall msg proto
        msg = ForwardMsg_pb2.ForwardMsg()
        msg_el_proto = getattr(msg.delta.new_element, delta_type)
        msg_el_proto.CopyFrom(element_proto)

        if layout_config:
            if layout_config.height:
                msg.delta.new_element.height_config.CopyFrom(
                    get_height_config(layout_config.height)
                )

            if layout_config.width:
                msg.delta.new_element.width_config.CopyFrom(
                    get_width_config(layout_config.width)
                )

        # Only enqueue message and fill in metadata if there's a container.
        msg_was_enqueued = False
        if dg._root_container is not None and dg._cursor is not None:
            msg.metadata.delta_path[:] = dg._cursor.delta_path

            _enqueue_message(msg)
            msg_was_enqueued = True

        if msg_was_enqueued:
            # Get a DeltaGenerator that is locked to the current element
            # position.
            new_cursor = (
                dg._cursor.get_locked_cursor(
                    delta_type=delta_type, add_rows_metadata=add_rows_metadata
                )
                if dg._cursor is not None
                else None
            )

            output_dg = DeltaGenerator(
                root_container=dg._root_container,
                cursor=new_cursor,
                parent=dg,
            )

            # Elements inherit their parent form ids.
            # NOTE: Form ids aren't set in dg constructor.
            output_dg._form_data = FormData(current_form_id(dg))
        else:
            # If the message was not enqueued, just return self since it's a
            # no-op from the point of view of the app.
            output_dg = dg

        # Save message for replay if we're called from within @st.cache_data or @st.cache_resource
        caching.save_element_message(
            delta_type,
            element_proto,
            invoked_dg_id=self.id,
            used_dg_id=dg.id,
            returned_dg_id=output_dg.id,
        )

        return output_dg

    def _block(
        self,
        block_proto: Block_pb2.Block | None = None,
        dg_type: type | None = None,
    ) -> DeltaGenerator:
        if block_proto is None:
            block_proto = Block_pb2.Block()

        # Operate on the active DeltaGenerator, in case we're in a `with` block.
        dg = self._active_dg

        # Prevent nested columns & expanders by checking all parents.
        block_type = block_proto.WhichOneof("type")

        if dg._root_container is None or dg._cursor is None:
            return dg

        msg = ForwardMsg_pb2.ForwardMsg()
        msg.metadata.delta_path[:] = dg._cursor.delta_path
        msg.delta.add_block.CopyFrom(block_proto)

        # Normally we'd return a new DeltaGenerator that uses the locked cursor
        # below. But in this case we want to return a DeltaGenerator that uses
        # a brand new cursor for this new block we're creating.
        block_cursor = cursor.RunningCursor(
            root_container=dg._root_container,
            parent_path=(*dg._cursor.parent_path, dg._cursor.index),
        )

        # `dg_type` param added for st.status container. It allows us to
        # instantiate DeltaGenerator subclasses from the function.
        if dg_type is None:
            dg_type = DeltaGenerator

        block_dg = cast(
            "DeltaGenerator",
            dg_type(
                root_container=dg._root_container,
                cursor=block_cursor,
                parent=dg,
                block_type=block_type,
            ),
        )
        # Blocks inherit their parent form ids.
        # NOTE: Container form ids aren't set in proto.
        block_dg._form_data = FormData(current_form_id(dg))

        # Must be called to increment this cursor's index.
        dg._cursor.get_locked_cursor(add_rows_metadata=None)
        _enqueue_message(msg)

        caching.save_block_message(
            block_proto,
            invoked_dg_id=self.id,
            used_dg_id=dg.id,
            returned_dg_id=block_dg.id,
        )

        return block_dg


def _writes_directly_to_sidebar(dg: DeltaGenerator) -> bool:
    in_sidebar = any(a._root_container == RootContainer.SIDEBAR for a in dg._ancestors)
    has_container = bool(list(dg._ancestor_block_types))
    return in_sidebar and not has_container
