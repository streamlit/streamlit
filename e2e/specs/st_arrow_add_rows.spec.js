describe("st._arrow_add_rows", () => {
  // Doesn't have to run before each, since these tests are stateless.
  before(() => {
    // Increasing timeout since we're waiting for
    // dataframes, and charts to be rendered.
    Cypress.config("defaultCommandTimeout", 30000);

    cy.loadApp("http://localhost:3000/");

    // Wait for 'data-stale' attr to go away, so the snapshot looks right.
    cy.get(".element-container")
      .should("have.attr", "data-stale", "false")
      .invoke("css", "opacity", "1");

    cy.prepForElementSnapshots();
  });

  beforeEach(() => {
    // Check that the app is fully loaded
    return cy.get(".element-container").should("have.length", 9);
  });

  it("checks that no new elements are created", () => {
    cy.get(".element-container [data-testid='stTable']").should(
      "have.length",
      1
    );
    cy.get(".element-container .stDataFrame").should("have.length", 1);
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']").should(
      "have.length",
      6
    );
  });

  it("correctly adds rows to the table", () => {
    cy.get(".element-container [data-testid='stTable'] tbody tr").should(
      "have.length",
      4
    );
  });

  it("correctly adds rows to charts", () => {
    cy.get(".element-container [data-testid='stArrowVegaLiteChart']").each(
      (element, index) => {
        return cy
          .get(element)
          .matchThemedSnapshots(`arrowstArrowVegaLiteChart-${index}`);
      }
    );
  });

  it("correctly adds rows to dataframe", () => {
    cy.get(".element-container .stDataFrame").each((element, index) => {
      return cy.get(element).matchThemedSnapshots(`dataFrame-${index}`);
    });
  });

  it("raises an exception when the shapes don't match", () => {
    cy.get(".element-container .stAlert")
      .should("have.length", 1)
      .matchThemedSnapshots("different-shapes");
  });
});
