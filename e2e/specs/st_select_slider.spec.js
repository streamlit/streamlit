describe("st.select_slider", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
    cy.prepForElementSnapshots();
  });

  it("displays correct number of elements", () => {
    cy.get(".element-container .stSlider").should("have.length", 8);
  });

  it("looks right when disabled", () => {
    cy.getIndexed(".stSlider", 4).matchThemedSnapshots(
      "disabled-select-slider"
    );
  });

  it("looks right when label hidden", () => {
    cy.getIndexed(".stSlider", 5).matchThemedSnapshots(
      "hidden-label-select-slider"
    );
  });

  it("looks right when label collapsed", () => {
    cy.getIndexed(".stSlider", 6).matchThemedSnapshots(
      "collapsed-label-select-slider"
    );
  });

  it("shows labels", () => {
    cy.getIndexed(".stSlider label", 0).should("have.text", "Label 1");

    cy.getIndexed(".stSlider label", 1).should("have.text", "Label 2");

    cy.getIndexed(".stSlider label", 2).should("have.text", "Label 3");

    cy.getIndexed(".stSlider label", 3).should("have.text", "Label 4");

    cy.getIndexed(".stSlider label", 4).should("have.text", "Label 5");

    cy.getIndexed(".stSlider label", 5).should("have.text", "Label 6");
  });

  it("has correct values", () => {
    cy.getIndexed(".stMarkdown", 0).should(
      "have.text",
      "Value 1: ('orange', 'blue')"
    );

    cy.getIndexed(".stMarkdown", 1).should("have.text", "Value 2: 1");

    cy.getIndexed(".stMarkdown", 2).should("have.text", "Value 3: (2, 5)");

    cy.getIndexed(".stMarkdown", 3).should("have.text", "Value 4: 5");

    cy.getIndexed(".stMarkdown", 4).should(
      "have.text",
      "Value 5: ('orange', 'blue')"
    );

    cy.getIndexed(".stMarkdown", 7).should("have.text", "Value 8: 1");

    cy.getIndexed(".stMarkdown", 8).should(
      "have.text",
      "Select slider changed: False"
    );
  });

  it("has correct aria-valuetext", () => {
    cy.getIndexed('.stSlider [role="slider"]', 0).should(
      "have.attr",
      "aria-valuetext",
      "orange"
    );

    cy.getIndexed('.stSlider [role="slider"]', 1).should(
      "have.attr",
      "aria-valuetext",
      "blue"
    );
  });

  it("increments the value on right arrow key press", () => {
    cy.getIndexed('.stSlider [role="slider"]', 0)
      .click()
      .type("{rightarrow}", { force: true });

    cy.getIndexed(".stMarkdown", 0).should(
      "have.text",
      "Value 1: ('yellow', 'blue')"
    );

    cy.getIndexed('.stSlider [role="slider"]', 0).should(
      "have.attr",
      "aria-valuetext",
      "yellow"
    );

    cy.getIndexed('.stSlider [role="slider"]', 1).should(
      "have.attr",
      "aria-valuetext",
      "blue"
    );
  });

  it("decrements the value on left arrow key press", () => {
    cy.getIndexed('.stSlider [role="slider"]', 0)
      .click()
      .type("{leftarrow}", { force: true });

    cy.getIndexed(".stMarkdown", 0).should(
      "have.text",
      "Value 1: ('red', 'blue')"
    );

    cy.getIndexed('.stSlider [role="slider"]', 0).should(
      "have.attr",
      "aria-valuetext",
      "red"
    );

    cy.getIndexed('.stSlider [role="slider"]', 1).should(
      "have.attr",
      "aria-valuetext",
      "blue"
    );
  });

  it("maintains its state on rerun", () => {
    cy.getIndexed('.stSlider [role="slider"]', 0)
      .click()
      .type("{leftarrow}", { force: true });

    cy.rerunScript();

    cy.getIndexed(".stMarkdown", 0).should(
      "have.text",
      "Value 1: ('red', 'blue')"
    );
  });

  it("calls callback if one is registered", () => {
    // This selects the slider ends, so range sliders have two, and this is the
    // 11th element in the list.
    cy.getIndexed('.stSlider [role="slider"]', 10)
      .click()
      .type("{rightarrow}", { force: true });

    cy.get(".stMarkdown").should(
      "contain.text",
      "Value 8: 2" + "Select slider changed: True"
    );
  });
});
