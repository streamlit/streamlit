describe("Legacy Dataframes with different sizes", () => {
  // All sizes are 2px smaller than the actual size, due to 1px border.
  const expected = [
    { width: "702px", height: "298px" },
    { width: "248px", height: "148px" },
    { width: "248px", height: "298px" },
    { width: "702px", height: "148px" }
  ];

  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("should show as expected", () => {
    cy.get(".element-container .stDataFrame")
      .should("have.length", 4)
      .each(($element, index) => {
        return cy
          .wrap($element)
          .should("have.css", "width", expected[index].width)
          .should("have.css", "height", expected[index].height);
      });
  });
});
