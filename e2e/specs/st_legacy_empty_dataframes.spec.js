describe("Legacy Dataframes", () => {
  const DF_SELECTOR = ".stDataFrame";

  before(() => {
    // http://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();

    // Wait for the site to be fully loaded
    cy.get(".element-container").should($els => {
      expect($els).to.have.length.of.at.least(10);
    });
  });

  it("have consistent empty visuals", () => {
    cy.get(DF_SELECTOR).each((el, idx) => {
      return cy.wrap(el).matchThemedSnapshots(`legacy_empty_dataframes${idx}`);
    });
  });
});
