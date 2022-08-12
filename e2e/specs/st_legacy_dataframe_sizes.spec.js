describe("Legacy Dataframes and Tables snapshots", () => {
  before(() => {
    // Increasing timeout since we're waiting for
    // dataframes and tables to be rendered.
    Cypress.config("defaultCommandTimeout", 30000);

    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();

    // HACK: Add `overflow: auto` to all tables to prevent Cypress
    // from throwing [RangeError: The value of "offset" is out of range.]
    cy.get("[data-testid='stTable']").each($element => {
      cy.wrap($element).invoke("css", "overflow", "auto");
    });
  });

  it("have consistent st._legacy_dataframe visuals", () => {
    cy.get(".stDataFrame").each(($element, index) => {
      return cy
        .wrap($element)
        .matchThemedSnapshots("legacy-dataframe-visuals" + index);
    });
  });

  it("have consistent st._legacy_table visuals", () => {
    cy.get("[data-testid='stTable']").each(($element, index) => {
      return cy
        .wrap($element)
        .matchThemedSnapshots("legacy-table-visuals" + index);
    });
  });
});
