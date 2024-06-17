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

"""Allows us to create and absorb changes (aka Deltas) to elements."""

from __future__ import annotations

import sys
from contextvars import ContextVar
from copy import deepcopy
from typing import (
    TYPE_CHECKING,
    Any,
    Callable,
    Final,
    Hashable,
    Iterable,
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
    type_util,
    util,
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
from streamlit.elements.form import FormData, FormMixin, current_form_id
from streamlit.elements.graphviz_chart import GraphvizMixin
from streamlit.elements.heading import HeadingMixin
from streamlit.elements.html import HtmlMixin
from streamlit.elements.iframe import IframeMixin
from streamlit.elements.image import ImageMixin
from streamlit.elements.json import JsonMixin
from streamlit.elements.layouts import LayoutsMixin
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
from streamlit.elements.widgets.button import ButtonMixin
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
from streamlit.errors import NoSessionContext, StreamlitAPIException
from streamlit.proto import Block_pb2, ForwardMsg_pb2
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime import caching
from streamlit.runtime.scriptrunner import get_script_run_ctx

if TYPE_CHECKING:
    from google.protobuf.message import Message
    from numpy import typing as npt
    from pandas import DataFrame

    from streamlit.cursor import Cursor
    from streamlit.elements.arrow import Data
    from streamlit.elements.lib.built_in_chart_utils import AddRowsMetadata


MAX_DELTA_BYTES: Final[int] = 14 * 1024 * 1024  # 14MB

Value = TypeVar("Value")
DG = TypeVar("DG", bound="DeltaGenerator")

# Type aliases for Ancestor Block Types
BlockType: TypeAlias = str
AncestorBlockTypes: TypeAlias = Iterable[BlockType]


_use_warning_has_been_displayed: bool = False


def _maybe_print_use_warning() -> None:
    """Print a warning if Streamlit is imported but not being run with `streamlit run`.
    The warning is printed only once, and is printed using the root logger.
    """
    global _use_warning_has_been_displayed

    if not _use_warning_has_been_displayed:
        _use_warning_has_been_displayed = True

        warning = cli_util.style_for_cli("Warning:", bold=True, fg="yellow")

        if env_util.is_repl():
            logger.get_logger("root").warning(
                f"\n  {warning} to view a Streamlit app on a browser, use Streamlit in a file and\n  run it with the following command:\n\n    streamlit run [FILE_NAME] [ARGUMENTS]"
            )

        elif not runtime.exists() and config.get_option(
            "global.showWarningOnDirectExecution"
        ):
            script_name = sys.argv[0]

            logger.get_logger("root").warning(
                f"\n  {warning} to view this Streamlit app on a browser, run it with the following\n  command:\n\n    streamlit run {script_name} [ARGUMENTS]"
            )


class DeltaGenerator(
    AlertMixin,
    BalloonsMixin,
    BokehMixin,
    ButtonMixin,
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
            for _, func in mixin.__dict__.items():
                if callable(func):
                    func.__module__ = self.__module__

    def __repr__(self) -> str:
        return util.repr_(self)

    def __enter__(self) -> None:
        # with block started
        dg_stack.set(dg_stack.get() + (self,))

    def __exit__(
        self,
        type: Any,
        value: Any,
        traceback: Any,
    ) -> Literal[False]:
        # with block ended

        dg_stack.set(dg_stack.get()[:-1])

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

    def __deepcopy__(self, _memo):
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
        else:
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
        if ctx and ctx.current_fragment_id and _writes_directly_to_sidebar(dg):
            raise StreamlitAPIException(
                "Calling `st.sidebar` in a function wrapped with `st.experimental_fragment` "
                "is not supported. To write elements to the sidebar with a fragment, "
                "call your fragment function inside a `with st.sidebar` context manager."
            )

        # Warn if an element is being changed but the user isn't running the streamlit server.
        _maybe_print_use_warning()

        # Copy the marshalled proto into the overall msg proto
        msg = ForwardMsg_pb2.ForwardMsg()
        msg_el_proto = getattr(msg.delta.new_element, delta_type)
        msg_el_proto.CopyFrom(element_proto)

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
        block_proto: Block_pb2.Block = Block_pb2.Block(),
        dg_type: type | None = None,
    ) -> DeltaGenerator:
        # Operate on the active DeltaGenerator, in case we're in a `with` block.
        dg = self._active_dg

        # Prevent nested columns & expanders by checking all parents.
        block_type = block_proto.WhichOneof("type")
        # Convert the generator to a list, so we can use it multiple times.
        ancestor_block_types = list(dg._ancestor_block_types)
        _check_nested_element_violation(self, block_type, ancestor_block_types)

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
            parent_path=dg._cursor.parent_path + (dg._cursor.index,),
        )

        # `dg_type` param added for st.status container. It allows us to
        # instantiate DeltaGenerator subclasses from the function.
        if dg_type is None:
            dg_type = DeltaGenerator

        block_dg = cast(
            DeltaGenerator,
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

    def _arrow_add_rows(
        self: DG,
        data: Data = None,
        **kwargs: (
            DataFrame | npt.NDArray[Any] | Iterable[Any] | dict[Hashable, Any] | None
        ),
    ) -> DG | None:
        """Concatenate a dataframe to the bottom of the current one.

        Parameters
        ----------
        data : pandas.DataFrame, pandas.Styler, numpy.ndarray, Iterable, dict, or None
            Table to concat. Optional.

        **kwargs : pandas.DataFrame, numpy.ndarray, Iterable, dict, or None
            The named dataset to concat. Optional. You can only pass in 1
            dataset (including the one in the data parameter).

        Example
        -------
        >>> import streamlit as st
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df1 = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> my_table = st.table(df1)
        >>>
        >>> df2 = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> my_table.add_rows(df2)
        >>> # Now the table shown in the Streamlit app contains the data for
        >>> # df1 followed by the data for df2.

        You can do the same thing with plots. For example, if you want to add
        more data to a line chart:

        >>> # Assuming df1 and df2 from the example above still exist...
        >>> my_chart = st.line_chart(df1)
        >>> my_chart.add_rows(df2)
        >>> # Now the chart shown in the Streamlit app contains the data for
        >>> # df1 followed by the data for df2.

        And for plots whose datasets are named, you can pass the data with a
        keyword argument where the key is the name:

        >>> my_chart = st.vega_lite_chart({
        ...     'mark': 'line',
        ...     'encoding': {'x': 'a', 'y': 'b'},
        ...     'datasets': {
        ...       'some_fancy_name': df1,  # <-- named dataset
        ...      },
        ...     'data': {'name': 'some_fancy_name'},
        ... }),
        >>> my_chart.add_rows(some_fancy_name=df2)  # <-- name used as keyword

        """
        if self._root_container is None or self._cursor is None:
            return self

        if not self._cursor.is_locked:
            raise StreamlitAPIException("Only existing elements can `add_rows`.")

        # Accept syntax st._arrow_add_rows(df).
        if data is not None and len(kwargs) == 0:
            name = ""
        # Accept syntax st._arrow_add_rows(foo=df).
        elif len(kwargs) == 1:
            name, data = kwargs.popitem()
        # Raise error otherwise.
        else:
            raise StreamlitAPIException(
                "Wrong number of arguments to add_rows()."
                "Command requires exactly one dataset"
            )

        # When doing _arrow_add_rows on an element that does not already have data
        # (for example, st.line_chart() without any args), call the original
        # st.foo() element with new data instead of doing a _arrow_add_rows().
        if (
            "add_rows_metadata" in self._cursor.props
            and self._cursor.props["add_rows_metadata"]
            and self._cursor.props["add_rows_metadata"].last_index is None
        ):
            st_method = getattr(
                self, self._cursor.props["add_rows_metadata"].chart_command
            )
            st_method(data, **kwargs)
            return None

        new_data, self._cursor.props["add_rows_metadata"] = _prep_data_for_add_rows(
            data,
            self._cursor.props["add_rows_metadata"],
        )

        msg = ForwardMsg_pb2.ForwardMsg()
        msg.metadata.delta_path[:] = self._cursor.delta_path

        import streamlit.elements.arrow as arrow_proto

        default_uuid = str(hash(self._get_delta_path_str()))
        arrow_proto.marshall(msg.delta.arrow_add_rows.data, new_data, default_uuid)

        if name:
            msg.delta.arrow_add_rows.name = name
            msg.delta.arrow_add_rows.has_name = True

        _enqueue_message(msg)

        return self


main_dg = DeltaGenerator(root_container=RootContainer.MAIN)
sidebar_dg = DeltaGenerator(root_container=RootContainer.SIDEBAR, parent=main_dg)
event_dg = DeltaGenerator(root_container=RootContainer.EVENT, parent=main_dg)
bottom_dg = DeltaGenerator(root_container=RootContainer.BOTTOM, parent=main_dg)

# The dg_stack tracks the currently active DeltaGenerator, and is pushed to when
# a DeltaGenerator is entered via a `with` block. This is implemented as a ContextVar
# so that different threads or async tasks can have their own stacks.
dg_stack: ContextVar[tuple[DeltaGenerator, ...]] = ContextVar(
    "dg_stack", default=(main_dg,)
)


def get_last_dg_added_to_context_stack() -> DeltaGenerator | None:
    """Get the last added DeltaGenerator of the stack in the current context.

    Returns None if the stack has only one element or is empty for whatever reason.
    """
    current_stack = dg_stack.get()
    # If set to "> 0" and thus return the only delta generator in the stack - which logically makes more sense -, some unit tests
    # fail. It looks like the reason is that they create their own main delta generator but do not populate the dg_stack correctly. However, to be on the safe-side,
    # we keep the logic but leave the comment as shared knowledge for whoever will look into this in the future.
    if len(current_stack) > 1:
        return current_stack[-1]
    return None


def _prep_data_for_add_rows(
    data: Data,
    add_rows_metadata: AddRowsMetadata | None,
) -> tuple[Data, AddRowsMetadata | None]:
    if not add_rows_metadata:
        # When calling add_rows on st.table or st.dataframe we want styles to pass through.
        return type_util.convert_anything_to_df(data, allow_styler=True), None

    # If add_rows_metadata is set, it indicates that the add_rows used called
    # on a chart based on our built-in chart commands.

    # For built-in chart commands we have to reshape the data structure
    # otherwise the input data and the actual data used
    # by vega_lite will be different, and it will throw an error.
    from streamlit.elements.lib.built_in_chart_utils import prep_chart_data_for_add_rows

    return prep_chart_data_for_add_rows(data, add_rows_metadata)


def _enqueue_message(msg: ForwardMsg_pb2.ForwardMsg) -> None:
    """Enqueues a ForwardMsg proto to send to the app."""
    ctx = get_script_run_ctx()

    if ctx is None:
        raise NoSessionContext()

    if ctx.current_fragment_id and msg.WhichOneof("type") == "delta":
        msg.delta.fragment_id = ctx.current_fragment_id

    ctx.enqueue(msg)


def _writes_directly_to_sidebar(dg: DG) -> bool:
    in_sidebar = any(a._root_container == RootContainer.SIDEBAR for a in dg._ancestors)
    has_container = bool(len(list(dg._ancestor_block_types)))
    return in_sidebar and not has_container


def _check_nested_element_violation(
    dg: DeltaGenerator, block_type: str | None, ancestor_block_types: list[BlockType]
) -> None:
    """Check if elements are nested in a forbidden way.

    Raises
    ------
      StreamlitAPIException: throw if an invalid element nesting is detected.
    """

    if block_type == "column":
        num_of_parent_columns = dg._count_num_of_parent_columns(ancestor_block_types)
        if dg._root_container == RootContainer.SIDEBAR and num_of_parent_columns > 0:
            raise StreamlitAPIException(
                "Columns cannot be placed inside other columns in the sidebar. This is only possible in the main area of the app."
            )
        if num_of_parent_columns > 1:
            raise StreamlitAPIException(
                "Columns can only be placed inside other columns up to one level of nesting."
            )
    if block_type == "chat_message" and block_type in ancestor_block_types:
        raise StreamlitAPIException(
            "Chat messages cannot nested inside other chat messages."
        )
    if block_type == "expandable" and block_type in ancestor_block_types:
        raise StreamlitAPIException(
            "Expanders may not be nested inside other expanders."
        )
    if block_type == "popover" and block_type in ancestor_block_types:
        raise StreamlitAPIException("Popovers may not be nested inside other popovers.")
