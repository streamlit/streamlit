from playwright.sync_api import Page

from conftest import ImageCompareFunction


def test_dataframe_column_types(
    themed_app: Page, assert_snapshot: ImageCompareFunction
):
    # Create locators for all elements with stDataFrame class
    st_dataframe_elements = themed_app.query_selector_all(".stDataFrame")

    # Expect the number of stDataFrame elements "to be strictly equal" to 9.
    assert len(st_dataframe_elements) == 9, "Unexpected number of dataframe elements"

    for i, element in enumerate(st_dataframe_elements):
        # Expect the screenshot "to be" the same as the previously stored screenshot.
        assert_snapshot(
            element.screenshot(),
            name=f"dataframe-column-types-{i}",
        )
