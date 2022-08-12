describe("st.number_input", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.get(".stNumberInput").should("have.length", 9);

    cy.get(".stNumberInput").each((el, idx) => {
      // @ts-ignore
      return cy.wrap(el).matchThemedSnapshots("number_input" + idx);
    });
  });

  it("has correct default values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " 0.0 "' +
        'value 2: " 1 "' +
        'value 3: " 1 "' +
        'value 4: " 0 "' +
        'value 5: " 0 "' +
        'value 6: " 0.0 "' +
        'value 7: " 0.0 "' +
        'value 8: " 0.0 "' +
        'value 9: " 0.0 "' +
        "number input changed: False"
    );
  });

  it("displays instructions correctly on change", () => {
    cy.get(".stNumberInput input")
      .first()
      .clear()
      .type("10");

    cy.get(".stNumberInput")
      .first()
      .matchThemedSnapshots("number_input_change", {
        focus: "input"
      });
  });

  it("sets value correctly on enter keypress", () => {
    cy.get(".stNumberInput input")
      .first()
      .clear()
      .type("10{enter}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " 10.0 "' +
        'value 2: " 1 "' +
        'value 3: " 1 "' +
        'value 4: " 0 "' +
        'value 5: " 0 "' +
        'value 6: " 0.0 "' +
        'value 7: " 0.0 "' +
        'value 8: " 0.0 "' +
        'value 9: " 0.0 "' +
        "number input changed: False"
    );
  });

  it("sets value correctly on blur", () => {
    cy.get(".stNumberInput input")
      .first()
      .clear()
      .type("10")
      .blur();

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " 10.0 "' +
        'value 2: " 1 "' +
        'value 3: " 1 "' +
        'value 4: " 0 "' +
        'value 5: " 0 "' +
        'value 6: " 0.0 "' +
        'value 7: " 0.0 "' +
        'value 8: " 0.0 "' +
        'value 9: " 0.0 "' +
        "number input changed: False"
    );
  });

  it("has the correct step value when clicked", () => {
    cy.get(".stNumberInput button.step-up")
      .should("have.length.at.least", 9)
      .each((el, idx) => {
        // skip disabled widget
        if (idx != 5) {
          return cy
            .wrap(el)
            .last()
            .click({ force: true });
        }
      });

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " 0.01 "' +
        'value 2: " 2 "' +
        'value 3: " 2 "' +
        'value 4: " 2 "' +
        'value 5: " 1 "' +
        'value 6: " 0.0 "' +
        'value 7: " 0.01 "' +
        'value 8: " 0.01 "' +
        'value 9: " 0.01 "' +
        "number input changed: True"
    );
  });

  it("has the correct step value with keypress", () => {
    cy.get(".stNumberInput input")
      .first()
      .type("{downarrow}");

    cy.get(".stMarkdown").should(
      "have.text",
      'value 1: " -0.01 "' +
        'value 2: " 1 "' +
        'value 3: " 1 "' +
        'value 4: " 0 "' +
        'value 5: " 0 "' +
        'value 6: " 0.0 "' +
        'value 7: " 0.0 "' +
        'value 8: " 0.0 "' +
        'value 9: " 0.0 "' +
        "number input changed: False"
    );
  });
});
