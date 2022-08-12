describe("handles arrow empty charts", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    // Wait for the site to be fully loaded
    cy.get(".element-container").should($els => {
      expect($els).to.have.length.of.at.least(10);
    });

    cy.prepForElementSnapshots();
  });

  it("gracefully handles no data", () => {
    // vega-lite
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']").each(
      (el, i) => {
        return cy.wrap(el).matchThemedSnapshots(`arrowVegaLiteChart-${i}`);
      }
    );

    // pyplot
    cy.get("[data-testid='stImage'] > img").should("have.attr", "src");

    // BUG https://github.com/cypress-io/cypress/issues/4322
    // cy.get('.stDeckGlChart canvas')
    //  .should('exist')
  });

  it("handles no data with exception", () => {
    cy.getIndexed(".stException .message", 0).should(
      "have.text",
      "ValueError: Vega-Lite charts require a non-empty spec dict."
    );

    cy.getIndexed(".stException .message", 1).should(
      "have.text",
      "ValueError: Vega-Lite charts require a non-empty spec dict."
    );

    cy.getIndexed(".stException .message", 2).should(
      "have.text",
      "ValueError: Vega-Lite charts require a non-empty spec dict."
    );

    cy.getIndexed(".stException .message", 3).should(
      "have.text",
      "ValueError: Vega-Lite charts require a non-empty spec dict."
    );

    cy.getIndexed(".stException .message", 4).should(
      "have.text",
      "TypeError: _arrow_altair_chart() missing 1 required positional argument: 'altair_chart'"
    );
  });
});
