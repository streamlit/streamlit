describe("st._legacy_dataframe", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.get(".element-container .stDataFrame")
      .find(".ReactVirtualized__Grid__innerScrollContainer")
      .find("[data-testid='StyledDataFrameDataCell']")
      .as("cells");
  });

  it("displays a pandas dataframe", () => {
    cy.get(".element-container").find(".stDataFrame");
  });

  it("checks number of cells", () => {
    cy.get("@cells")
      .its("length")
      .should("eq", 100);
  });

  it("contains all numbers from 0..99", () => {
    cy.get("@cells").each(($element, index) => {
      return cy.wrap($element).should("contain", index);
    });
  });

  it("highlights the first cell", () => {
    cy.get("@cells")
      .first()
      .should("have.css", "background-color", "rgb(255, 255, 0)");
  });
});
