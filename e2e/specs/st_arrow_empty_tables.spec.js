describe("Empty Arrow Tables", () => {
  const TABLE_SELECTOR = "[data-testid='stTable'] > table";

  before(() => {
    // http://gs.statcounter.com/screen-resolution-stats/desktop/worldwide
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();

    // Wait for the site to be fully loaded
    cy.get(".element-container").should($els => {
      expect($els).to.have.length.of.at.least(6);
    });
  });

  it("have consistent empty table visuals", () => {
    cy.get(TABLE_SELECTOR)
      .filter(idx => idx >= 0 && idx <= 3)
      .each((el, idx) => {
        return cy.wrap(el).matchThemedSnapshots(`arrow_empty_tables${idx}`);
      });
  });

  it("have consistent empty one-column table visuals", () => {
    cy.getIndexed(TABLE_SELECTOR, 4).each((el, idx) => {
      return cy
        .wrap(el)
        .matchThemedSnapshots(`arrow_empty_tables_one_col${idx}`);
    });
  });

  it("have consistent empty two-column table visuals", () => {
    cy.getIndexed(TABLE_SELECTOR, 5).each((el, idx) => {
      return cy
        .wrap(el)
        .matchThemedSnapshots(`arrow_empty_tables_two_col${idx}`);
    });
  });
});
