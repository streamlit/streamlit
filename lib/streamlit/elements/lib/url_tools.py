from typing import Dict, Iterable, List, Mapping, Union
from urllib.parse import urlsplit, urlencode, parse_qs, urlunsplit


def merge_query_params(
    url: str,
    query_params: Union[Mapping[str, Union[str, Iterable[str]]], None],
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


def normalize_query_params(
    query_params: Union[Mapping[str, Union[str, Iterable[str]]], None],
) -> Dict[str, List[str]]:
    if query_params is None:
        return {}

    return {
        key: [value] if isinstance(value, str) else list(value)
        for key, value in query_params.items()
    }
