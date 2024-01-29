# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import ImageCompareFunction


def test_button_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "image"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["invalid", "link"],
    ]

    buttons = app.get_by_test_id("stButton")
    expect(buttons).to_have_count(4)
    for index, case in enumerate(cases):
        assert_snapshot(
            buttons.nth(index),
            name=f"st_button-{case[0]}_{case[1]}",
        )


def test_checkbox_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "table"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    checkboxes = app.get_by_test_id("stCheckbox")
    expect(checkboxes).to_have_count(4)
    for index, case in enumerate(cases):
        assert_snapshot(
            checkboxes.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_checkbox-{case[0]}_{case[1]}",
        )


def test_radio_labels_handle_markdown(app: Page, assert_snapshot: ImageCompareFunction):
    cases = [
        ["invalid", "heading1"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    radioes = app.get_by_test_id("stRadio")
    expect(radioes).to_have_count(4)
    for index, case in enumerate(cases):
        assert_snapshot(
            radioes.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_radio-{case[0]}_{case[1]}",
        )


def test_radio_option_supports_links(app: Page, assert_snapshot: ImageCompareFunction):
    radio_option = app.get_by_test_id("stRadio").nth(3).locator("p").nth(0)
    assert_snapshot(
        radio_option,
        name="st_radio-supports_links_in_options",
    )


def test_selectbox_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "heading2"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    selectboxes = app.get_by_test_id("stSelectbox")
    expect(selectboxes).to_have_count(4)
    for index, case in enumerate(cases):
        assert_snapshot(
            selectboxes.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_selectbox-{case[0]}_{case[1]}",
        )


def test_multiselect_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "ordered-list"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    multiselects = app.get_by_test_id("stMultiSelect")
    expect(multiselects).to_have_count(4)
    for index, case in enumerate(cases):
        assert_snapshot(
            multiselects.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_multiselect-{case[0]}_{case[1]}",
        )


def test_slider_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "unordered-list"],
        ["invalid", "task_list"],
        ["valid", "markdown"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "colored"],
        ["valid", "link"],
        ["valid", "link"],
    ]

    sliders = app.get_by_test_id("stSlider")
    expect(sliders).to_have_count(8)
    for index, case in enumerate(cases):
        even = index % 2 == 0
        if even:
            assert_snapshot(
                sliders.nth(index).get_by_test_id("stWidgetLabel"),
                name=f"st_slider-{case[0]}_{case[1]}",
            )
        else:
            assert_snapshot(
                sliders.nth(index), name=f"st_select_slider-{case[0]}_{case[1]}"
            )


def test_text_input_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "blockquote"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    text_inputs = app.get_by_test_id("stTextInput")
    assert text_inputs.count() == 4
    for index, case in enumerate(cases):
        assert_snapshot(
            text_inputs.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_text_input-{case[0]}_{case[1]}",
        )


def test_number_input_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "horizontal-rule"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    number_inputs = app.get_by_test_id("stNumberInput")
    assert number_inputs.count() == 4
    for index, case in enumerate(cases):
        assert_snapshot(
            number_inputs.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_number_input-{case[0]}_{case[1]}",
        )


def test_text_area_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "image"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    text_areas = app.get_by_test_id("stTextArea")
    assert text_areas.count() == 4
    for index, case in enumerate(cases):
        assert_snapshot(
            text_areas.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_text_area-{case[0]}_{case[1]}",
        )


def test_date_input_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "table"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    date_inputs = app.get_by_test_id("stDateInput")
    assert date_inputs.count() == 4
    for index, case in enumerate(cases):
        assert_snapshot(
            date_inputs.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_date_input-{case[0]}_{case[1]}",
        )


def test_time_input_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "heading1"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    time_inputs = app.get_by_test_id("stTimeInput")
    assert time_inputs.count() == 4
    for index, case in enumerate(cases):
        assert_snapshot(
            time_inputs.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_time_input-{case[0]}_{case[1]}",
        )


def test_file_uploader_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "heading2"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    file_uploaders = app.get_by_test_id("stFileUploader")
    assert file_uploaders.count() == 4
    for index, case in enumerate(cases):
        assert_snapshot(
            file_uploaders.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_file_uploader-{case[0]}_{case[1]}",
        )


def test_color_picker_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "ordered-list"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    color_pickers = app.get_by_test_id("stColorPicker")
    assert color_pickers.count() == 4
    for index, case in enumerate(cases):
        assert_snapshot(
            color_pickers.nth(index).get_by_test_id("stWidgetLabel"),
            name=f"st_color_picker-{case[0]}_{case[1]}",
        )


def test_metric_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "unordered-list"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    metrics = app.get_by_test_id("stMetric")
    assert metrics.count() == 4
    for index, case in enumerate(cases):
        assert_snapshot(
            metrics.nth(index).get_by_test_id("stMetricLabel"),
            name=f"st_metric-{case[0]}_{case[1]}",
        )


def test_expander_labels_handle_markdown(
    app: Page, assert_snapshot: ImageCompareFunction
):
    cases = [
        ["invalid", "task-list"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    expanders = app.get_by_test_id("stExpander")
    assert expanders.count() == 4
    for index, case in enumerate(cases):
        assert_snapshot(
            expanders.nth(index),
            name=f"st_expander-{case[0]}_{case[1]}",
        )


def test_tab_labels_handle_markdown(app: Page, assert_snapshot: ImageCompareFunction):
    cases = [
        ["invalid", "blockquote-and-hr"],
        ["valid", "markdown"],
        ["valid", "colored"],
        ["valid", "link"],
    ]

    tabs = app.get_by_test_id("stTab")
    assert tabs.count() == 4
    for index, case in enumerate(cases):
        assert_snapshot(
            tabs.nth(index),
            name=f"st_tab-{case[0]}_{case[1]}",
        )
