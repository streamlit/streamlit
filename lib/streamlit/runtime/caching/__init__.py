import contextlib
from typing import TYPE_CHECKING, Iterator

from google.protobuf.message import Message

from streamlit.proto.Block_pb2 import Block

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

from .memo_decorator import (
    MEMO_CALL_STACK,
    MEMO_MESSAGES_CALL_STACK,
    _memo_caches,
    MemoAPI,
)
from .singleton_decorator import (
    SINGLETON_CALL_STACK,
    SINGLETON_MESSAGE_CALL_STACK,
    _singleton_caches,
    SingletonAPI,
)


def save_element_message(
    delta_type: str,
    element_proto: Message,
    invoked_dg_id: str,
    used_dg_id: str,
    returned_dg_id: str,
) -> None:
    MEMO_MESSAGES_CALL_STACK.save_element_message(
        delta_type, element_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )
    SINGLETON_MESSAGE_CALL_STACK.save_element_message(
        delta_type, element_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )


def save_block_message(
    block_proto: Block,
    invoked_dg_id: str,
    used_dg_id: str,
    returned_dg_id: str,
) -> None:
    MEMO_MESSAGES_CALL_STACK.save_block_message(
        block_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )
    SINGLETON_MESSAGE_CALL_STACK.save_block_message(
        block_proto, invoked_dg_id, used_dg_id, returned_dg_id
    )


def maybe_show_cached_st_function_warning(dg, st_func_name: str) -> None:
    MEMO_CALL_STACK.maybe_show_cached_st_function_warning(dg, st_func_name)
    SINGLETON_CALL_STACK.maybe_show_cached_st_function_warning(dg, st_func_name)


@contextlib.contextmanager
def suppress_cached_st_function_warning() -> Iterator[None]:
    with MEMO_CALL_STACK.suppress_cached_st_function_warning(), SINGLETON_CALL_STACK.suppress_cached_st_function_warning():
        yield


# Explicitly export public symbols
from .memo_decorator import (
    get_memo_stats_provider as get_memo_stats_provider,
)
from .singleton_decorator import (
    get_singleton_stats_provider as get_singleton_stats_provider,
)

# Create and export public API singletons.
memo = MemoAPI()
singleton = SingletonAPI()
