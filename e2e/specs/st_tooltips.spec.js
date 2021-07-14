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

const defaultTooltip = `This is a really long tooltip.Lorem ipsum dolor sit am\
et, consectetur adipiscing elit. Ut ut turpis vitae\njusto ornare venenatis a \
vitae leo. Donec mollis ornare ante, eu ultricies\ntellus ornare eu. Donec ero\
s risus, ultrices ut eleifend vel, auctor eu turpis.\nIn consectetur erat vel \
ante accumsan, a egestas urna aliquet. Nullam eget\nsapien eget diam euismod e\
leifend. Nulla purus enim, finibus ut velit eu,\nmalesuada dictum nulla. In no\
n arcu et risus maximus fermentum eget nec ante.`;

const tooltipCodeBlock1 = `This\nis\na\ncode\nblock!`;
const tooltipCodeBlock2 = `for i in range(10):\n    x = i * 10\n    print(x)`;

const tooltipTextBlock1 = `This is a regular text block!\nTest1\nTest2`;
const tooltipTextBlock2 = `thisisatooltipwithnoindents. It has some spaces but\
 no idents.`;

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

describe("tooltip text with dedent on widgets", () => {
  before(() => {
    cy.visit("http://localhost:3000/");
  });

  it("Display text properly on tooltips on text input", () => {
    cy.get(`.stTextInput .stTooltipIcon`)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "not.exist"
    );
    cy.get("[data-testid=stMarkdownContainer]").should(
      "have.text",
      defaultTooltip
    );
  });

  it("Display text properly on tooltips on numberinput", () => {
    cy.get(`.stNumberInput .stTooltipIcon`)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "have.text",
      tooltipCodeBlock1
    );
  });

  it("Display text properly on tooltips on checkbox", () => {
    cy.get(`.stCheckbox .stTooltipIcon`)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "not.exist"
    );
    cy.get("[data-testid=stMarkdownContainer]").should(
      "have.text",
      tooltipTextBlock1
    );
  });

  it("Display text properly on tooltips on radio", () => {
    cy.get(`.stRadio .stTooltipIcon`)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "have.text",
      tooltipCodeBlock2
    );
  });

  it("Display text properly on tooltips on Selectbox", () => {
    cy.get(`.stSelectbox .stTooltipIcon`)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "not.exist"
    );
    cy.get("[data-testid=stMarkdownContainer]").should(
      "have.text",
      defaultTooltip
    );
  });

  it("Display text properly on tooltips on timeinput", () => {
    cy.get(`.stTimeInput .stTooltipIcon`)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "have.text",
      tooltipCodeBlock1
    );
  });

  it("Display text properly on tooltips on dateinput", () => {
    cy.get(`.stDateInput .stTooltipIcon`)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "not.exist"
    );
    cy.get("[data-testid=stMarkdownContainer]").should(
      "have.text",
      tooltipTextBlock1
    );
  });

  //This one needs to be the first slider
  it("Display text properly on tooltips on sliders", () => {
    cy.get(`.stSlider .stTooltipIcon`)
      .eq(0)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "have.text",
      tooltipCodeBlock2
    );
  });

  it("Display text properly on tooltips on colorpicker", () => {
    cy.get(`[data-testid="stColorPicker"]  .stTooltipIcon`)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "not.exist"
    );
    cy.get("[data-testid=stMarkdownContainer]").should(
      "have.text",
      tooltipTextBlock2
    );
  });

  it("Display text properly on tooltips on fileuploader", () => {
    cy.get(`[data-testid="stFileUploader"] .stTooltipIcon`)
      .invoke("show")
      .click();
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "not.exist"
    );
    cy.get("[data-testid=stMarkdownContainer]").should(
      "have.text",
      defaultTooltip
    );
  });

  it("Display text properly on tooltips on multiselect", () => {
    cy.get(`.stMultiSelect .stTooltipIcon`)
      .invoke("show")
      .click({ force: true })
      .trigger("mouseover");
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "have.text",
      tooltipCodeBlock1
    );
  });

  it("Display text properly on tooltips on textarea", () => {
    cy.get(`.stTextArea .stTooltipIcon`)
      .invoke("show")
      .click({ force: true })
      .trigger("mouseover");
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "not.exist"
    );
    cy.get("[data-testid=stMarkdownContainer]").should(
      "have.text",
      tooltipTextBlock1
    );
  });

  it("Display text properly on tooltips on sliders", () => {
    cy.get(`.stSlider .stTooltipIcon`)
      .eq(1)
      .invoke("show")
      .trigger("mouseenter")
      .trigger("mouseover");
    cy.get("[data-testid=stMarkdownContainer] .stCodeBlock").should(
      "have.text",
      tooltipCodeBlock2
    );
  });

  it("Display text properly on tooltips on button", () => {
    cy.get(".stButton [data-testid=tooltipHoverTarget]").trigger("mouseover");
    cy.get("[data-testid=stMarkdownContainer]").should(
      "contain.text",
      tooltipTextBlock2
    );
  });
});
