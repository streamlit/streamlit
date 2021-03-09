/**
 * @license
 * Copyright 2018-2020 Streamlit Inc.
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

describe("tooltips on widgets", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("displays tooltips on textinput", () => {
    cy.get(`.stTextInput .stTooltipIcon`).should("have.length", 1);
  });

  it("displays tooltips on numberinput", () => {
    cy.get(`.stNumberInput .stTooltipIcon`).should("have.length", 1);
  });

  it("displays tooltips on checkbox", () => {
    cy.get(`.stCheckbox .stTooltipIcon`).should("have.length", 1);
  });

  it("displays tooltips on radio", () => {
    cy.get(`.stRadio .stTooltipIcon`).should("have.length", 1);
  });

  it("displays tooltips on button", () => {
    // button mounts two .stTooltipIcon elements, one for mobile, one regular
    cy.get(`.stButton .stTooltipIcon`).should("have.length", 2);
  });

  it("displays tooltips on selectbox", () => {
    cy.get(`.stSelectbox .stTooltipIcon`).should("have.length", 1);
  });

  it("displays tooltips on timeinput", () => {
    cy.get(`.stTimeInput .stTooltipIcon`).should("have.length", 1);
  });

  it("displays tooltips on dateinput", () => {
    cy.get(`.stDateInput .stTooltipIcon`).should("have.length", 1);
  });

  it("displays tooltips on colorpicker", () => {
    cy.get(`[data-testid="stColorPicker"] .stTooltipIcon`).should(
      "have.length",
      1
    );
  });

  it("displays tooltips on fileuploader", () => {
    cy.get(`[data-testid="stFileUploader"] .stTooltipIcon`).should(
      "have.length",
      1
    );
  });

  it("displays tooltips on multiselect", () => {
    cy.get(`.stMultiSelect .stTooltipIcon`).should("have.length", 1);
  });

  it("displays tooltips on textarea", () => {
    cy.get(`.stTextArea .stTooltipIcon`).should("have.length", 1);
  });

  it("displays tooltips on sliders", () => {
    // two sliders, st.slider and st.select_slider
    cy.get(`.stSlider .stTooltipIcon`).should("have.length", 2);
  });
});
