describe("Legacy Dataframe format", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  beforeEach(() => {
    cy.get(".element-container .stDataFrame")
      .find("[data-testid='StyledDataFrameDataCell']")
      .as("cells");
  });

  it("correctly formats the first cell", () => {
    cy.get("@cells")
      .first()
      .should("have.text", "3.14");
  });

  it("correctly formats the last cell", () => {
    cy.get("@cells")
      .last()
      .should("have.text", "3.10");
  });
});
