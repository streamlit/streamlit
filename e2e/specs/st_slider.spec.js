describe("st.slider", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("looks right", () => {
    cy.getIndexed(".stSlider", 2).matchThemedSnapshots("slider");
  });

  it("looks right when disabled", () => {
    cy.getIndexed(".stSlider", 5).matchThemedSnapshots("disabled-slider");
  });

  it("looks right when label hidden", () => {
    cy.getIndexed(".stSlider", 6).matchThemedSnapshots("hidden-label-slider");
  });

  it("looks right when label collapsed", () => {
    cy.getIndexed(".stSlider", 7).matchThemedSnapshots("collapsed-label-slider");
  });

  it("shows labels", () => {
    cy.get(".stSlider label").should(
      "have.text",
      "Label A" +
      "Label B" +
      "Label 1" +
      "Label 2" +
      "Label 3 - This is a very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very long label" +
      "Label 4" +
      "Label 5" +
      "Label 6" +
      "Label 7"
    );
  });

  it("shows full label when the label is long", () => {
    cy.getIndexed(".stSlider", 4).matchThemedSnapshots(
      "slider_with_long_label"
    );
  });

  it("shows full thumb value when the value is long", () => {
    cy.getIndexed(".stSlider", 0).matchThemedSnapshots("long_thumb_value");
  });

  it("does not overlap expander container when thumb value is long", () => {
    cy.getIndexed(".stSlider", 1).matchThemedSnapshots("expander_thumb_value");
  });

  it("has correct values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "Value A: 12345678" +
      "Value B: 10000" +
      "Value 1: 25" +
      "Value 2: (25.0, 75.0)" +
      "Value 3: 1" +
      "Value 4: 10000" +
      "Value 5: 25" +
      "Value 6: 36" +
      "Value 7: 25" +
      "Slider changed: False"
    );
  });

  it("handles value changes", () => {
    // trigger click in the center of the slider
    cy.getIndexed('.stSlider [role="slider"]', 2)
      .parent()
      .click();

    cy.getIndexed(".stMarkdown", 2).should("have.text", "Value 1: 50");
  });

  it("increments the value on right arrow key press", () => {
    cy.getIndexed('.stSlider [role="slider"]', 2)
      .click()
      .type("{rightarrow}", {force: true});

    cy.getIndexed(".stMarkdown", 2).should("have.text", "Value 1: 26");
  });

  it("decrements the value on left arrow key press", () => {
    cy.getIndexed('.stSlider [role="slider"]', 2)
      .click()
      .type("{leftarrow}", {force: true});

    cy.getIndexed(".stMarkdown", 2).should("have.text", "Value 1: 24");
  });

  it("maintains its state on rerun", () => {
    cy.getIndexed('.stSlider [role="slider"]', 2)
      .click()
      .type("{leftarrow}", {force: true});

    cy.rerunScript();

    cy.getIndexed(".stMarkdown", 2).should("have.text", "Value 1: 24");
  });

  it("calls callback if one is registered", () => {
    cy.get(".stMarkdown").should(
      "contain.text",
      "Value 7: 25" + "Slider changed: False"
    );

    cy.get('.stSlider [role="slider"]')
      .last()
      .click()
      .type("{rightarrow}", {force: true});

    cy.get(".stMarkdown").should(
      "contain.text",
      "Value 7: 26" + "Slider changed: True"
    );
  });
});
