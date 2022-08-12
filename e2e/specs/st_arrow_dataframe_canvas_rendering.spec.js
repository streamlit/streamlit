describe("Interactive DataFrame canvas rendering", () => {
  before(() => {
    // Increasing timeout since we're waiting for
    // dataframes and tables to be rendered.
    Cypress.config("defaultCommandTimeout", 30000);

    cy.loadApp("http://localhost:3000/");
    cy.prepForElementSnapshots();
  });

  it("shows widget correctly", () => {
    cy.get(".stDataFrame").should("have.length", 29);

    /** Since glide-data-grid uses HTML canvas for rendering the table we
    cannot run any tests based on the HTML DOM. Therefore, we only use snapshot
    matching to test that our table examples render correctly. In addition, glide-data-grid
    itself also has more advanced canvas based tests for some of the interactive features. */

    cy.get(".stDataFrame").each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots("data-grid-canvas-" + idx);
    });
  });
});
