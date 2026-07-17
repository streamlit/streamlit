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

"""Allows us to create and absorb changes (aka Deltas) to elements."""

from __future__ import annotations

import sys
import threading
from collections.abc import Callable, Iterable
from copy import deepcopy
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    NoReturn,
    TypeAlias,
    TypeVar,
    cast,
)

from streamlit import (
    cli_util,
    config,
    cursor,
    env_util,
    logger,
    runtime,
    util,
)
from streamlit.components.v2.bidi_component import BidiComponentMixin
from streamlit.delta_generator_singletons import (
    context_dg_stack,
    get_last_dg_added_to_context_stack,
)
from streamlit.elements.alert import AlertMixin
from streamlit.elements.arrow import ArrowMixin
from streamlit.elements.balloons import BalloonsMixin
from streamlit.elements.code import CodeMixin
from streamlit.elements.deck_gl_json_chart import PydeckMixin
from streamlit.elements.empty import EmptyMixin
from streamlit.elements.exception import ExceptionMixin
from streamlit.elements.form import FormMixin
from streamlit.elements.graphviz_chart import GraphvizMixin
from streamlit.elements.heading import HeadingMixin
from streamlit.elements.help import HelpMixin
from streamlit.elements.html import HtmlMixin
from streamlit.elements.iframe import IframeMixin
from streamlit.elements.image import ImageMixin
from streamlit.elements.json import JsonMixin
from streamlit.elements.layouts import LayoutsMixin
from streamlit.elements.lib.form_utils import FormData, current_form_id
from streamlit.elements.lib.layout_utils import (
    get_height_config,
    get_text_alignment_config,
    get_width_config,
    validate_text_alignment,
)
from streamlit.elements.map import MapMixin
from streamlit.elements.markdown import MarkdownMixin
from streamlit.elements.media import MediaMixin
from streamlit.elements.mermaid_chart import MermaidChartMixin
from streamlit.elements.metric import MetricMixin
from streamlit.elements.pdf import PdfMixin
from streamlit.elements.plotly_chart import PlotlyMixin
from streamlit.elements.progress import ProgressMixin
from streamlit.elements.pyplot import PyplotMixin
from streamlit.elements.skeleton import SkeletonMixin
from streamlit.elements.snow import SnowMixin
from streamlit.elements.space import SpaceMixin
from streamlit.elements.spinner import SpinnerMixin
from streamlit.elements.table import TableMixin
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
from streamlit.elements.widgets.feedback import FeedbackMixin
from streamlit.elements.widgets.file_uploader import FileUploaderMixin
from streamlit.elements.widgets.menu_button import MenuButtonMixin
from streamlit.elements.widgets.multiselect import MultiSelectMixin
from streamlit.elements.widgets.number_input import NumberInputMixin
from streamlit.elements.widgets.pagination import PaginationMixin
from streamlit.elements.widgets.radio import RadioMixin
from streamlit.elements.widgets.select_slider import SelectSliderMixin
from streamlit.elements.widgets.selectbox import SelectboxMixin
from streamlit.elements.widgets.slider import SliderMixin
from streamlit.elements.widgets.text_widgets import TextWidgetsMixin
from streamlit.elements.widgets.time_widgets import TimeWidgetsMixin
from streamlit.elements.write import WriteMixin
from streamlit.errors import NoSessionContext, StreamlitAPIException
from streamlit.proto import Block_pb2
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime import caching
from streamlit.runtime.outside_container_wrapper import OutsideContainerWrapper
from streamlit.runtime.scriptrunner import enqueue_message as _enqueue_message
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ThreadState,
)

if TYPE_CHECKING:
    from types import TracebackType

    from google.protobuf.message import Message

    from streamlit.cursor import Cursor
    from streamlit.elements.lib.layout_utils import LayoutConfig
    from streamlit.proto.Element_pb2 import Element as ElementProto
    from streamlit.runtime.fragment import FragmentStorage
    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        FragmentThreadState,
        ScriptRunContext,
    )

MAX_DELTA_BYTES: Final[int] = 14 * 1024 * 1024  # 14MB

Value = TypeVar("Value")

# Type aliases for Ancestor Block Types
BlockType: TypeAlias = str
AncestorBlockTypes: TypeAlias = Iterable[BlockType]
ForwardMsgCreator: TypeAlias = Callable[[], ForwardMsg]


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
    # Invariant: ThreadState is initialized whenever a ScriptRunContext exists
    # on this thread, since ScriptRunContext.reset() and add_script_run_ctx()
    # are the only public entry points for binding ctx, and both seed
    # ThreadState. ThreadState.get() is therefore safe here without a guard.
    if ctx and ThreadState.get().in_fragment_callback:
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
    ButtonMixin,
    ButtonGroupMixin,
    CameraInputMixin,
    ChatMixin,
    CheckboxMixin,
    CodeMixin,
    ColorPickerMixin,
    EmptyMixin,
    ExceptionMixin,
    FeedbackMixin,
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
    MermaidChartMixin,
    MetricMixin,
    MenuButtonMixin,
    MultiSelectMixin,
    NumberInputMixin,
    PaginationMixin,
    PdfMixin,
    PlotlyMixin,
    ProgressMixin,
    PydeckMixin,
    PyplotMixin,
    RadioMixin,
    SelectboxMixin,
    SelectSliderMixin,
    SkeletonMixin,
    SliderMixin,
    SnowMixin,
    SpaceMixin,
    SpinnerMixin,
    TableMixin,
    JsonMixin,
    TextMixin,
    TextWidgetsMixin,
    TimeWidgetsMixin,
    ToastMixin,
    WriteMixin,
    ArrowMixin,
    VegaChartsMixin,
    DataEditorMixin,
    BidiComponentMixin,
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

        # Tracks which fragment's scope created this container. Used to clear
        # cached outside-write wrappers when that fragment reruns.
        self._creating_fragment_id: str | None = None

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
        """The DeltaGenerator that's currently 'active'.
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
        """The root DeltaGenerator - that is, the top-level ancestor
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
        dg._creating_fragment_id = self._creating_fragment_id
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
        """Our Cursor. This will be None if we're not running in a
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
    def _id(self) -> str:
        return str(id(self))

    def _get_transient_cursor(self) -> cursor.Cursor:
        cursor = self._active_dg._cursor
        if cursor is None:
            raise NoSessionContext("Cursor is not set")

        return cursor.get_transient_cursor()

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
        layout_config: LayoutConfig | None = None,
        has_one_shot_effect: bool = False,
    ) -> DeltaGenerator:
        """Create NewElement delta, fill it, and enqueue it.

        Parameters
        ----------
        delta_type : str
            The name of the streamlit method being called
        element_proto : proto
            The actual proto in the NewElement type e.g. Alert/Button/Slider

        Returns
        -------
        DeltaGenerator
            Return a DeltaGenerator that can be used to modify the newly-created
            element.
        """
        # Operate on the active DeltaGenerator, in case we're in a `with` block.
        dg = self._active_dg

        ctx = get_script_run_ctx()
        if ctx:
            ts = ThreadState.get()
            if ts.is_parallel_worker:
                fragment_path = ts.delta_path
                cursor_path = tuple(dg._cursor.delta_path) if dg._cursor else ()
                # Empty fragment_path means the fragment's cursor was None; in that
                # case _is_inside_fragment_path would always return True anyway, so
                # skip the check.
                if fragment_path and not _is_inside_fragment_path(
                    cursor_path, fragment_path
                ):
                    raise StreamlitAPIException(
                        "Writing to containers outside a parallel fragment is not "
                        "allowed during the initial page load, because parallel "
                        "fragments run concurrently on separate threads and "
                        "external container writes are not thread-safe.\n\n"
                        "To fix this, move the element inside the fragment body, "
                        "or gate the write behind a widget interaction "
                        "(e.g., `if st.button(...):`) so it runs during a "
                        "sequential fragment rerun instead."
                    )

            if ts.fragment_id and _needs_outside_wrapper(dg, ts, ctx.fragment_storage):
                dg = _get_or_create_outside_wrapper(dg, ts, ctx)

        # Warn if an element is being changed but the user isn't running the streamlit server.
        _maybe_print_use_warning()
        # Warn if an element is being changed during a fragment callback.
        _maybe_print_fragment_callback_warning()

        # Copy the marshalled proto into the overall msg proto
        msg = ForwardMsg()
        msg_el_proto = getattr(msg.delta.new_element, delta_type)
        msg_el_proto.CopyFrom(element_proto)

        if layout_config:
            if layout_config.height is not None:
                msg.delta.new_element.height_config.CopyFrom(
                    get_height_config(layout_config.height)
                )
            if layout_config.width is not None:
                msg.delta.new_element.width_config.CopyFrom(
                    get_width_config(layout_config.width)
                )
            if layout_config.text_alignment is not None:
                validate_text_alignment(layout_config.text_alignment)
                msg.delta.new_element.text_alignment_config.CopyFrom(
                    get_text_alignment_config(layout_config.text_alignment)
                )

        if has_one_shot_effect:
            msg.delta.new_element.has_one_shot_effect = True

        # Only enqueue message and fill in metadata if there's a container.
        msg_was_enqueued = False
        if dg._root_container is not None and dg._cursor is not None:
            msg.metadata.delta_path[:] = dg._cursor.delta_path

            _enqueue_message(msg)
            msg_was_enqueued = True

        if msg_was_enqueued:
            # Get a DeltaGenerator that is locked to the current element
            # position.
            new_cursor = dg._cursor.lock_element() if dg._cursor is not None else None

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
            invoked_dg_id=self._id,
            used_dg_id=dg._id,
            returned_dg_id=output_dg._id,
            layout_config=layout_config,
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

        ctx = get_script_run_ctx()
        ts = ThreadState.get() if ctx else None
        if (
            ctx is not None
            and ts is not None
            and ts.fragment_id
            and _needs_outside_wrapper(dg, ts, ctx.fragment_storage)
        ):
            dg = _get_or_create_outside_wrapper(dg, ts, ctx)

        # Reassigning dg above drops the type narrowing from the None-guard.
        parent_cursor = cast("Cursor", dg._cursor)
        root_container = cast("int", dg._root_container)

        # Snapshot delta_path before open_block() advances the parent cursor.
        block_delta_path = list(parent_cursor.delta_path)

        # Create a child cursor for this new block. open_block() also advances
        # the parent cursor, so we capture delta_path above before this call.
        block_cursor = parent_cursor.open_block()

        # `dg_type` param added for st.status container. It allows us to
        # instantiate DeltaGenerator subclasses from the function.
        if dg_type is None:
            dg_type = DeltaGenerator

        block_dg = cast(
            "DeltaGenerator",
            dg_type(
                root_container=root_container,
                cursor=block_cursor,
                parent=dg,
                block_type=block_type,
            ),
        )
        # Blocks inherit their parent form ids.
        # NOTE: Container form ids aren't set in proto.
        block_dg._form_data = FormData(current_form_id(dg))
        block_dg._creating_fragment_id = ts.fragment_id if ts else None

        # open_block() already advanced the parent cursor, so we only emit here.
        _enqueue_add_block(block_delta_path, block_proto)

        caching.save_block_message(
            block_proto,
            invoked_dg_id=self._id,
            used_dg_id=dg._id,
            returned_dg_id=block_dg._id,
        )

        return block_dg

    def _transient(
        self,
        element_proto: ElementProto,
        layout_config: LayoutConfig | None = None,
    ) -> tuple[ForwardMsgCreator, ForwardMsgCreator]:
        """Provides the factory functions for creating and clearing transient elements.
        It preserves the delta path, transient index, and the set of transient elements.

        Returns a tuple of two functions:
        - create_transient_element: Creates the new transient element.
        - clear_transient_element: Clears the transient element.
        """
        transient_cursor = self._get_transient_cursor()
        delta_path = transient_cursor.delta_path
        transient_index = transient_cursor.transient_index
        transient_elements = transient_cursor.transient_elements

        if layout_config:
            if layout_config.height is not None:
                element_proto.height_config.CopyFrom(
                    get_height_config(layout_config.height)
                )
            if layout_config.width is not None:
                element_proto.width_config.CopyFrom(
                    get_width_config(layout_config.width)
                )

        # Revalidate the use of the lock here in the event
        # better support threading/multiprocessing in Streamlit
        transient_lock = threading.Lock()

        def create_transient_element() -> ForwardMsg:
            with transient_lock:
                transient_elements[transient_index] = element_proto

                create_msg = ForwardMsg()
                create_msg.metadata.delta_path[:] = delta_path
                create_msg.metadata.cacheable = False
                # Make sure the transient message is set as it will
                # not be set if there are no transient elements
                create_msg.delta.new_transient.SetInParent()
                for e in transient_elements:
                    create_msg.delta.new_transient.elements.add().CopyFrom(e)

            return create_msg

        def clear_transient_element() -> ForwardMsg:
            with transient_lock:
                if transient_index in transient_elements:
                    del transient_elements[transient_index]

                clear_msg = ForwardMsg()
                clear_msg.metadata.delta_path[:] = delta_path
                clear_msg.metadata.cacheable = False
                clear_msg.delta.new_transient.SetInParent()
                for e in transient_elements:
                    clear_msg.delta.new_transient.elements.add().CopyFrom(e)

            return clear_msg

        return create_transient_element, clear_transient_element


def _is_inside_fragment_path(
    cursor_path: tuple[int, ...],
    fragment_path: tuple[int, ...],
) -> bool:
    """Check if cursor_path is within or equal to fragment_path."""
    if len(cursor_path) < len(fragment_path):
        return False
    return cursor_path[: len(fragment_path)] == fragment_path


def _enqueue_add_block(delta_path: list[int], block_proto: Block_pb2.Block) -> None:
    """Send an add_block ForwardMsg for `block_proto` at `delta_path`."""
    msg = ForwardMsg()
    msg.metadata.delta_path[:] = delta_path
    msg.delta.add_block.CopyFrom(block_proto)
    _enqueue_message(msg)


def _needs_outside_wrapper(
    dg: DeltaGenerator,
    ts: FragmentThreadState,
    fragment_storage: FragmentStorage,
) -> bool:
    """Return whether `dg` is a fragment writing to a container declared outside
    its scope, and not already inside one of this fragment's wrappers.
    """
    if ts.is_parallel_worker or not ts.fragment_id or not ts.delta_path:
        return False

    # Sidebar and bottom are shared containers — both the main script and
    # fragments append to them, so a wrapper is needed to isolate the
    # fragment's content. Main is unreachable here (fragments write into
    # their own sub-container, not the root). Event containers are
    # single-owner.
    if dg._is_top_level:
        return dg._root_container in {RootContainer.SIDEBAR, RootContainer.BOTTOM}

    cursor_path = tuple(dg._cursor.delta_path) if dg._cursor else ()
    if _is_inside_fragment_path(cursor_path, ts.delta_path):
        return False

    # If this DG is a descendant of a wrapper already created for this
    # fragment, the write is already isolated — no additional wrapper needed.
    wrapper_dg_ids = {
        wrapper.delta_generator._id
        for wrapper in fragment_storage.outside_wrappers_for(ts.fragment_id)
    }
    return all(ancestor._id not in wrapper_dg_ids for ancestor in dg._ancestors)


def _get_or_create_outside_wrapper(
    dg: DeltaGenerator,
    ts: FragmentThreadState,
    ctx: ScriptRunContext,
) -> DeltaGenerator:
    """Return the cached wrapper DG, creating one on first write, or raise on a
    standalone rerun that has no reserved slot.
    """
    fragment_storage = ctx.fragment_storage
    fragment_id = cast("str", ts.fragment_id)
    container_id = dg._id

    cached = fragment_storage.get_outside_wrapper(fragment_id, container_id)
    if cached is not None:
        return cached.delta_generator

    # fragment_ids_this_run is non-empty only during a standalone fragment
    # rerun (not a full app rerun). If the container was created by one of
    # the currently-running fragments, its cursor is valid and we can safely
    # allocate a new wrapper (e.g. a child fragment writing into a container
    # owned by its parent fragment during the parent's rerun). Otherwise the
    # container's creating scope hasn't run, so we can't reserve a slot.
    if ctx.fragment_ids_this_run and (
        dg._creating_fragment_id not in ctx.fragment_ids_this_run
    ):
        raise StreamlitAPIException(
            "A fragment tried to write to a container created outside the "
            "fragment, but that container was not written to during the initial "
            "run, so Streamlit could not reserve a stable position for it.\n\n"
            "Write to the container at least once during the full app run (e.g. "
            "claim the slot with `outside.empty()`), then fill it during fragment "
            "reruns."
        )

    parent_cursor = cast("Cursor", dg._cursor)
    root_container = cast("int", dg._root_container)
    block_proto = Block_pb2.Block()
    block_proto.transparent.SetInParent()
    block_proto.allow_empty = True

    creation_delta_path = list(parent_cursor.delta_path)

    # Match the outside container's cursor type. st.empty() uses a LockedCursor,
    # so the wrapper must also lock to preserve single-element semantics.
    parent_path = (*parent_cursor.parent_path, parent_cursor.index)
    if parent_cursor.is_locked:
        wrapper_cursor: Cursor = cursor.LockedCursor(
            root_container=root_container, parent_path=parent_path, index=0
        )
    else:
        wrapper_cursor = cursor.RunningCursor(
            root_container=root_container, parent_path=parent_path
        )

    wrapper_dg = DeltaGenerator(
        root_container=root_container,
        cursor=wrapper_cursor,
        parent=dg,
        block_type="transparent",
    )

    _enqueue_add_block(creation_delta_path, block_proto)
    # Advance the outside container's cursor exactly once, at creation time.
    parent_cursor.lock_element()

    fragment_storage.register_outside_wrapper(
        fragment_id,
        container_id,
        OutsideContainerWrapper(
            wrapper_dg,
            creation_delta_path,
            block_proto,
            creating_fragment_id=dg._creating_fragment_id,
        ),
    )
    return wrapper_dg
