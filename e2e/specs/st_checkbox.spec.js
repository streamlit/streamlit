describe("st.checkbox", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.get(".stCheckbox").should("have.length", 6);

    cy.get(".stCheckbox").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("checkbox" + idx);
    });
  });

  // We have to manually use the changeTheme command in the next two tests
  // since changing the theme between snapshots using the matchThemedSnapshots
  // command will unfocus the widget we're trying to take a snapshot of.
  xit("shows focused widget correctly in dark mode", () => {
    cy.changeTheme("Dark");

    cy.get(".stCheckbox")
      .first()
      // For whatever reason both click() and click({ force: true }) don't want
      // to work here, so we use {multiple: true} even though we only take a
      // snapshot of one of the checkboxes below.
      .click({ multiple: true });

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "value 1: False")
      .then(() => {
        return cy
          .get(".stCheckbox")
          .first()
          .matchImageSnapshot("checkbox-focused-dark");
      });
  });

  xit("shows focused widget correctly in light mode", () => {
    cy.changeTheme("Light");

    cy.get(".stCheckbox")
      .first()
      .click({ multiple: true });

    cy.get(".stMarkdown")
      .first()
      .should("have.text", "value 1: False")
      .then(() => {
        return cy
          .get(".stCheckbox")
          .first()
          .matchImageSnapshot("checkbox-focused");
      });
  });

  it("has correct initial values", () => {
    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: True" +
        "value 2: False" +
        "value 3: False" +
        "value 4: False" +
        "checkbox clicked: False" +
        "value 5: False" +
        "value 6: True"
    );
  });

  it("sets value correctly when user clicks", () => {
    cy.get(".stCheckbox")
      .should("have.length.at.least", 6)
      .click({ multiple: true });

    cy.get(".stMarkdown").should(
      "have.text",
      "value 1: False" +
        "value 2: True" +
        "value 3: True" +
        "value 4: True" +
        "checkbox clicked: True" +
        "value 5: False" +
        "value 6: True"
    );
  });
});
