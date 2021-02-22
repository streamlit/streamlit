/**
 * @license
 * Copyright 2018-2021 Streamlit Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const WIDGET_NAMES = [
  "area_chart",
  "bar_chart",
  "button",
  "checkbox",
  "code",
  "color_picker",
  "dataframe",
  "date_input",
  "file_uploader",
  "header",
  "latex",
  "markdown",
  "multiselect",
  "number_input",
  "progress",
  "radio",
  "select_slider",
  "selectbox",
  "slider",
  "subheader",
  "table",
  "text_area",
  "text_input",
  "time_input",
  "title",
  "write",
  "image",
  "map",
  "plotly_chart",
  "altair_chart",
  "vega_lite_chart",
  "graphviz_chart",
  "pydeck_chart"

  // I'm going to remove bokeh_chart for now, because the snapshot doesn't scroll
  // to the bokeh chart; I think Cypress is having trouble getting the offset of
  // the bokeh chart element. Noting that st_bokeh_chart.spec.js is also empty,
  // I'm just going to get this test merged and come back to adding bokeh_chart
  // at a later time.
  // "bokeh_chart",
];

// In st_sidebar_widgets we are wrapping the widget in an `.stBlock`, so mostly
// we are able to just snapshot that block. However, for some widgets, if we
// don't select the selector of the widget itself, the snapshot will cut off.
const SPECIFIC_SELECTORS = {
  date_input: ".stDateInput",
  multiselect: ".stMultiSelect",
  number_input: ".stNumberInput",
  selectbox: ".stSelectbox",
  text_area: ".stTextArea",
  text_input: ".stTextInput",
  time_input: ".stTimeInput",
  file_uploader: "[data-testid='stFileUploader']"
};

// Some widgets have a delayed load. This presents a problem because they
// appear in the DOM, causing Cypress to pick them up and capture a snapshot
// before the widget has loaded.
//
// For these widgets, we just wait 2000ms. This is ugly and non-deterministic.
// These are the widgets where there is just no other way. There's no selector
// we can use to consistently detect if the widget has loaded, or anything like
// that.
const WIDGETS_WITH_DELAYED_LOAD = [
  "area_chart",
  "bar_chart",
  "plotly_chart",
  "altair_chart",
  "vega_lite_chart",
  "graphviz_chart",
  "pydeck_chart",
  "map"
];

describe("sidebar widgets", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("matches snapshots", () => {
    function typeInTextInput(string) {
      cy.get(".stTextInput input")
        .first()
        .clear()
        .type(`${string}{enter}`);
    }

    cy.wrap(WIDGET_NAMES).each(widgetName => {
      const selector = "[data-testid='stSidebar'] [data-testid='stBlock']";

      typeInTextInput("");
      cy.get(selector).should("not.exist");
      typeInTextInput(widgetName);
      cy.get(selector).should("exist");

      if (WIDGETS_WITH_DELAYED_LOAD.includes(widgetName)) {
        cy.wait(2000);
      }

      let el = cy.get(selector);
      const specificSelector = SPECIFIC_SELECTORS[widgetName];
      if (specificSelector) {
        el = el.find(specificSelector);
      }
      el.matchImageSnapshot("sidebar-widgets-" + widgetName);
    });
  });
});
