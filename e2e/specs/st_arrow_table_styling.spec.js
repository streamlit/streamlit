describe("st._arrow_table styling", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");

    cy.get("[data-testid='stTable']").should("have.length", 3);

    cy.prepForElementSnapshots();
  });

  it("displays unstyled table", () => {
    cy.get("[data-testid='stTable']")
      .eq(0)
      .find("table tbody tr td")
      .eq(0)
      .should("contain", "1");

    cy.get("[data-testid='stTable']")
      .eq(0)
      .matchThemedSnapshots("arrow-table-unstyled");
  });

  it("displays table with custom formatted cells", () => {
    cy.getIndexed("[data-testid='stTable']", 1)
      .find("table tbody tr td")
      .eq(0)
      .should("contain", "100.00%");

    cy.getIndexed("[data-testid='stTable']", 1).matchThemedSnapshots(
      "arrow-table-formatted-cells"
    );
  });

  it("displays table with colored cells", () => {
    cy.getIndexed("[data-testid='stTable']", 2)
      .find("table tbody tr")
      .eq(0)
      .find("td")
      .each((el, i) => {
        if (i < 3) {
          return cy.wrap(el).should("have.css", "color", "rgb(0, 0, 0)");
        } else {
          return cy.wrap(el).should("have.css", "color", "rgb(255, 0, 0)");
        }
      });

    cy.getIndexed("[data-testid='stTable']", 2).matchThemedSnapshots(
      "arrow-table-colored-cells"
    );
  });
});
