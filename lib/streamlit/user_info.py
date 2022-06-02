from typing import Iterator, Mapping, NoReturn, Optional

from streamlit.errors import StreamlitAPIException
from streamlit.scriptrunner import get_script_run_ctx as _get_script_run_ctx
from streamlit.scriptrunner.script_run_context import UserInfo


class UserInfoProxy(Mapping[str, Optional[str]]):
    """
    A dict like proxy object for accessing information about current user.
    """

    def __getitem__(self, key: str) -> Optional[str]:
        ctx = _get_script_run_ctx()
        if ctx is not None:
            user_info = ctx.user_info
            return user_info[key]
        else:
            return None

    def __getattr__(self, key: str) -> Optional[str]:
        ctx = _get_script_run_ctx()
        if ctx is not None:
            user_info = ctx.user_info

            try:
                return user_info[key]
            except KeyError:
                raise AttributeError
        else:
            return None

    def __setattr__(self, name: str, value: str) -> NoReturn:
        raise StreamlitAPIException("st.experimental_user cannot be modified")

    def __setitem__(self, key: str, value: str) -> NoReturn:
        raise StreamlitAPIException("st.experimental_user cannot be modified")

    def __iter__(self) -> Iterator[str]:
        ctx = _get_script_run_ctx()
        if ctx is not None:
            user_info = ctx.user_info
            return iter(user_info)
        else:
            return []

    def __len__(self) -> int:
        ctx = _get_script_run_ctx()
        if ctx is not None:
            return len(ctx.user_info)
        return 0

    def to_dict(self) -> UserInfo:
        ctx = _get_script_run_ctx()
        if ctx is not None:
            return ctx.user_info
