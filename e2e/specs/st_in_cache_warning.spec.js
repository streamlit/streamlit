describe("st calls within cached functions", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays expected results", () => {
    // We should have two alerts
    cy.get(".element-container > .stException").should("have.length", 2);

    // One button
    cy.get(".element-container > .stButton").should("have.length", 1);

    // And three texts
    cy.get(".element-container > .stMarkdown").should("have.length", 3);
  });
});
