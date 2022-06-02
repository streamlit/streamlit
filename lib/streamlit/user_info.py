from typing import Mapping, Optional

from streamlit.errors import StreamlitAPIException
from streamlit.scriptrunner import get_script_run_ctx as _get_script_run_ctx


class UserInfoProxy(Mapping[str, Optional[str]]):
    """
    A dict like proxy object for accessing information about current user.
    """

    def __getitem__(self, key):
        ctx = _get_script_run_ctx()
        if ctx is not None:
            user_info = ctx.user_info
            return user_info[key]

    def __getattr__(self, key):
        ctx = _get_script_run_ctx()
        if ctx is not None:
            user_info = ctx.user_info

            try:
                return user_info[key]
            except KeyError:
                raise AttributeError

    def __setattr__(self, name, value):
        raise StreamlitAPIException("st.experimental_user cannot be modified")

    def __setitem__(self, key, value):
        raise StreamlitAPIException("st.experimental_user cannot be modified")

    def __iter__(self):
        ctx = _get_script_run_ctx()
        if ctx is not None:
            return iter(ctx.user_info)

    def __len__(self) -> int:
        ctx = _get_script_run_ctx()
        if ctx is not None:
            return len(ctx.user_info)
        return 0

    def to_dict(self):
        ctx = _get_script_run_ctx()
        if ctx is not None:
            return ctx.user_info
