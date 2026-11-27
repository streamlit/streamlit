from streamlit_mcp.client import interact_url
from streamlit_mcp.server import parse_args


def test_interact_url_appends_path() -> None:
    assert (
        interact_url("http://127.0.0.1:8506")
        == "http://127.0.0.1:8506/_stcore/agent/v1/interact"
    )


def test_interact_url_keeps_full_path() -> None:
    full = "http://127.0.0.1:8506/_stcore/agent/v1/interact"
    assert interact_url(full) == full


def test_interact_url_strips_trailing_slash() -> None:
    assert (
        interact_url("http://127.0.0.1:8506/")
        == "http://127.0.0.1:8506/_stcore/agent/v1/interact"
    )


def test_parse_args_http_transport() -> None:
    args = parse_args(
        ["--app-url", "http://127.0.0.1:8506", "--transport", "http", "--port", "8765"]
    )
    assert args.transport == "http"
    assert args.host == "127.0.0.1"
    assert args.port == 8765
    assert args.app_url == "http://127.0.0.1:8506"


def test_parse_args_stdio_is_default() -> None:
    args = parse_args([])
    assert args.transport == "stdio"
