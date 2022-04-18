from streamlit.scriptrunner import get_script_run_ctx as _get_script_run_ctx
from typing import Mapping, Dict, Optional, Iterator


class LazyUserInfo(Mapping[str, Optional[str]]):
    def __getitem__(self, key):
        ctx = _get_script_run_ctx()
        user_info = ctx.user_info
        return user_info[key]

    def __getattr__(self, key):
        ctx = _get_script_run_ctx()
        user_info = ctx.user_info

        try:
            return user_info[key]
        except KeyError:
            raise AttributeError

    def __iter__(self) -> Iterator[str]:
        ctx = _get_script_run_ctx()
        return iter(ctx.user_info)

    def __len__(self) -> int:
        ctx = _get_script_run_ctx()
        return len(ctx.user_info)

    def to_dict(self) -> Dict[str, Optional[str]]:
        ctx = _get_script_run_ctx()
        return ctx.user_info
