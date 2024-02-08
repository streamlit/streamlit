from typing import Dict, Iterable, Union
from urllib.parse import urlsplit, urlencode, parse_qs, urlunsplit


def merge_query_params(
    url: str,
    query_params: Union[Dict[str, Union[str, Iterable[str]]], None],
) -> str:
    if query_params is None:
        return url

    split = urlsplit(url=url)

    params = parse_qs(split.query)
    for key, value in query_params.items():
        if isinstance(value, str):
            params.setdefault(key, []).append(value)
        else:
            for item in value:
                params.setdefault(key, []).append(item)

    params_str = urlencode(params, doseq=True)

    split = split._replace(query=params_str)

    return urlunsplit(split)
