from streamlit.commands.query_params import QueryParams, _missing_key_error_message
from typing import Any, Iterator, List

def get_ctx_query_params():
    from streamlit.runtime.scriptrunner import get_script_run_ctx
    ctx = get_script_run_ctx()
    if ctx is None:
        return QueryParams()
    else:
        print(ctx.query_params)
        return ctx.query_params

class QueryParamsProxy():
    def __iter__(self) -> Iterator[Any]:
        return iter(get_ctx_query_params())
    
    def __len__(self) -> int:
        return len(get_ctx_query_params())

    def __getitem__(self, key: str) -> str:
        return get_ctx_query_params()[key]
    
    def __getattr__(self, key: str) -> str:
        try:
            return get_ctx_query_params()[key]
        except KeyError:
            raise AttributeError(_missing_key_error_message(key))
    
    def __delitem__(self, key: str) -> None:
        del get_ctx_query_params()[key]

    def __delitem__(self, key: str) -> None:
        try:
            del get_ctx_query_params()[key]
        except KeyError:
            raise AttributeError(_missing_key_error_message(key))

    def __setattr__(self, key: str, value: Any) -> None:
        try:
            get_ctx_query_params()[key] = value
        except KeyError:
            raise AttributeError(_missing_key_error_message(key))
    
    def __setitem__(self, key: str, value: str) -> None:
        get_ctx_query_params()[key] = value

    def get_all(self, key: str) -> List[str]:
        get_ctx_query_params().get_all(key)
    
    def __contains__(self, key: str) -> bool:
        return key in get_ctx_query_params()
    
    def __len__(self) -> int:
        return len(get_ctx_query_params())

    def clear(self) -> None:
        get_ctx_query_params().clear()

    def get(self, key: str) -> str:
        return get_ctx_query_params()[key]
        
