from streamlit_mcp.report import discrete_axis_order

MONTHS = ["Mar", "Apr", "May", "Jun", "Jul", "Aug"]
VALUES = [
    {
        "month": month,
        "value -- streamlit-generated": i,
        "color -- streamlit-generated": "net",
    }
    for i, month in enumerate(MONTHS)
]


def _spec(*, sort=..., x_type: str = "nominal") -> dict:
    x: dict = {
        "field": "month",
        "type": x_type,
        "scale": {},
        "title": "",
    }
    if sort is not ...:
        x["sort"] = sort
    return {
        "layer": [
            {
                "mark": {"type": "line"},
                "encoding": {
                    "x": x,
                    "y": {
                        "field": "value -- streamlit-generated",
                        "type": "quantitative",
                    },
                },
            }
        ]
    }


def test_omitted_sort_uses_vega_ascending() -> None:
    assert discrete_axis_order(
        _spec(),
        VALUES,
        "month",
        "value -- streamlit-generated",
    ) == ["Apr", "Aug", "Jul", "Jun", "Mar", "May"]


def test_null_sort_keeps_data_order() -> None:
    assert (
        discrete_axis_order(
            _spec(sort=None),
            VALUES,
            "month",
            "value -- streamlit-generated",
        )
        == MONTHS
    )


def test_explicit_domain_sort() -> None:
    assert discrete_axis_order(
        _spec(sort=["Jun", "Jul"]),
        VALUES,
        "month",
        "value -- streamlit-generated",
    ) == ["Jun", "Jul", "Mar", "Apr", "May", "Aug"]


def test_sort_by_y_encoding() -> None:
    assert discrete_axis_order(
        _spec(sort={"encoding": "y", "order": "descending"}),
        VALUES,
        "month",
        "value -- streamlit-generated",
    ) == list(reversed(MONTHS))
