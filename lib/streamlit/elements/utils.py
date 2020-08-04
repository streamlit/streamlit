import textwrap

from streamlit import type_util
from streamlit.report_thread import get_report_ctx
from streamlit.errors import DuplicateWidgetID
from typing import Optional, Any


def _clean_text(text):
    return textwrap.dedent(str(text)).strip()


def _build_duplicate_widget_message(
    widget_func_name: str, user_key: Optional[str] = None
) -> str:
    if user_key is not None:
        message = textwrap.dedent(
            """
            There are multiple identical `st.{widget_type}` widgets with
            `key='{user_key}'`.

            To fix this, please make sure that the `key` argument is unique for
            each `st.{widget_type}` you create.
            """
        )
    else:
        message = textwrap.dedent(
            """
            There are multiple identical `st.{widget_type}` widgets with the
            same generated key.

            (When a widget is created, it's assigned an internal key based on
            its structure. Multiple widgets with an identical structure will
            result in the same internal key, which causes this error.)

            To fix this, please pass a unique `key` argument to
            `st.{widget_type}`.
            """
        )

    return message.strip("\n").format(widget_type=widget_func_name, user_key=user_key)


def _set_widget_id(
    element_type: str,
    element_proto: Any,
    user_key: Optional[str] = None,
    widget_func_name: Optional[str] = None,
) -> None:
    """Set the widget id.

    Parameters
    ----------
    element_type : str
        The type of the element as stored in proto.
    element_proto : proto
        The proto of the specified type (e.g. Button/Multiselect/Slider proto)
    user_key : str or None
        Optional user-specified key to use for the widget ID.
        If this is None, we'll generate an ID by hashing the element.
    widget_func_name : str or None
        The widget's DeltaGenerator function name, if it's different from
        its element_type. Custom components are a special case: they all have
        the element_type "component_instance", but are instantiated with
        dynamically-named functions.

    """

    if widget_func_name is None:
        widget_func_name = element_type

    # Identify the widget with a hash of type + contents
    element_hash = hash((element_type, element_proto.SerializeToString()))
    if user_key is not None:
        widget_id = "%s-%s" % (user_key, element_hash)
    else:
        widget_id = "%s" % element_hash

    ctx = get_report_ctx()
    if ctx is not None:
        added = ctx.widget_ids_this_run.add(widget_id)
        if not added:
            raise DuplicateWidgetID(
                _build_duplicate_widget_message(widget_id, user_key)
            )
    element_proto.id = widget_id


def _get_widget_ui_value(
    element_type: str,
    element_proto: Any,
    user_key: Optional[str] = None,
    widget_func_name: Optional[str] = None,
) -> Any:
    """Get the widget ui_value from the report context.
    NOTE: This function should be called after the proto has been filled.

    Parameters
    ----------
    element_type : str
        The type of the element as stored in proto.
    element : proto
        The proto of the specified type (e.g. Button/Multiselect/Slider proto)
    user_key : str
        Optional user-specified string to use as the widget ID.
        If this is None, we'll generate an ID by hashing the element.
    widget_func_name : str or None
        The widget's DeltaGenerator function name, if it's different from
        its element_type. Custom components are a special case: they all have
        the element_type "component_instance", but are instantiated with
        dynamically-named functions.

    Returns
    -------
    ui_value : any
        The value of the widget set by the client or
        the default value passed. If the report context
        doesn't exist, None will be returned.

    """
    _set_widget_id(element_type, element_proto, user_key, widget_func_name)
    ctx = get_report_ctx()
    ui_value = ctx.widgets.get_widget_value(element_proto.id) if ctx else None
    return ui_value


def last_index_for_melted_dataframes(data):
    if type_util.is_dataframe_compatible(data):
        data = type_util.convert_anything_to_df(data)

        if data.index.size > 0:
            return data.index[-1]

    return None
