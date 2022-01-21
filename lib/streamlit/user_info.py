from streamlit.script_run_context import get_script_run_ctx as _get_script_run_ctx


class LazyUserInfo:
    def __getitem__(self, key):
        ctx = _get_script_run_ctx()
        user_info = ctx.user_info
        return user_info[key]

    def __getattr__(self, key):
        ctx = _get_script_run_ctx()
        user_info = ctx.user_info
        return user_info[key]
