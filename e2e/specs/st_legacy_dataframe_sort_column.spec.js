describe("st._legacy_dataframe - sort by column", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.get(".element-container .stDataFrame")
      .find("[data-testid='StyledDataFrameRowHeaderCell']")
      .last()
      .as("lastColumn");
  });

  it("toggles sort direction to asc when clicked once", () => {
    cy.get("@lastColumn").click();

    cy.get("@lastColumn").get("[data-test-sort-direction='ascending']");
  });

  it("toggles sort direction to desc when clicked twice", () => {
    cy.get("@lastColumn").click();
    cy.get("@lastColumn").click();

    cy.get("@lastColumn").get("[data-test-sort-direction='descending']");
  });

  // Issue: https://github.com/streamlit/streamlit/issues/2321
  it("toggles sort direction to asc when clicked 3 times", () => {
    cy.get("@lastColumn").click();
    cy.get("@lastColumn").click();
    cy.get("@lastColumn").click();

    cy.get("@lastColumn").get("[data-test-sort-direction='ascending']");
  });

  // Issue: https://github.com/streamlit/streamlit/issues/1105
  it("resets sort column index if the sorted column was removed", () => {
    cy.get("@lastColumn").click();
    // Remove the last column.
    cy.get(".step-down").click();

    cy.get(".stDataFrame [data-testid='sortIcon']").should("not.exist");
  });
});
