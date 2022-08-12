describe("st.radio", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.get(".stRadio").should("have.length", 9);

    cy.get(".stRadio").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("radio" + idx);
    });
  });

  // We have to manually use the changeTheme command in the next two tests
  // since changing the theme between snapshots using the matchThemedSnapshots
  // command will unfocus the widget we're trying to take a snapshot of.
  xit("shows focused widget correctly in dark mode", () => {
    cy.changeTheme("Dark");

    cy.get(".stRadio")
      .first()
      .find("input")
      .first()
      .click({ force: true });

    cy.get(".stMarkdown")
      .should(
        "have.text",
        "value 1: female" +
          "value 2: female" +
          "value 3: None" +
          "value 4: female" +
          "value 5: female"
      )
      .then(() => {
        return cy
          .get(".stRadio")
          .first()
          .matchImageSnapshot("radio-focused-dark");
      });
  });

  xit("shows focused widget correctly in light mode", () => {
    cy.changeTheme("Light");

    cy.get(".stRadio")
      .first()
      .find("input")
      .first()
      .click({ force: true });

    cy.get(".stMarkdown")
      .should(
        "have.text",
        "value 1: female" +
          "value 2: female" +
          "value 3: None" +
          "value 4: female" +
          "value 5: female"
      )
      .then(() => {
        return cy
          .get(".stRadio")
          .first()
          .matchImageSnapshot("radio-focused");
      });
  });

  it("has correct initial values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: male" +
        "value 2: female" +
        "value 3: None" +
        "value 4: female" +
        "value 5: female" +
        "value 6: female" +
        "value 7: female" +
        "value 8: female" +
        "value 9: male" +
        "radio changed: False"
    );
  });

  it("formats display values", () => {
    cy.getIndexed('.stRadio [role="radiogroup"]', 1).should(
      "have.text",
      "FemaleMale"
    );
  });

  it("handles no options", () => {
    cy.getIndexed('.stRadio [role="radiogroup"]', 2).should(
      "have.text",
      "No options to select."
    );

    cy.getIndexed('.stRadio [role="radiogroup"]', 2)
      .get("input")
      .should("be.disabled");
  });

  it("sets value correctly when user clicks", () => {
    cy.get(".stRadio").each((el, idx) => {
      // skip disabled widget - cypress gets around disabled pointer event
      if (idx != 3) {
        cy.wrap(el)
          .find("input")
          .last()
          .click({ force: true });
      }
    });

    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: male" +
        "value 2: male" +
        "value 3: None" +
        "value 4: female" +
        "value 5: male" +
        "value 6: male" +
        "value 7: male" +
        "value 8: male" +
        "value 9: male" +
        "radio changed: False"
    );
  });

  it("calls callback if one is registered", () => {
    cy.getIndexed(".stRadio", 8).then(el => {
      return cy
        .wrap(el)
        .find("input")
        .first()
        .click({ force: true });
    });

    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: male" +
        "value 2: female" +
        "value 3: None" +
        "value 4: female" +
        "value 5: female" +
        "value 6: female" +
        "value 7: female" +
        "value 8: female" +
        "value 9: female" +
        "radio changed: True"
    );
  });
});
