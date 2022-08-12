describe("st.title", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays correct number of elements", () => {
    cy.get(".element-container .stMarkdown h1").should("have.length", 2);
  });

  it("displays a title", () => {
    cy.get(".element-container .stMarkdown h1").then(els => {
      expect(els[0].textContent).to.eq("This title is awesome!");
      expect(els[1].textContent).to.eq("This title is awesome too!");
    });
  });

  it("displays title with anchors", () => {
    cy.get(".element-container .stMarkdown h1").then(els => {
      cy.wrap(els[0]).should("have.attr", "id", "this-title-is-awesome");
      cy.wrap(els[1]).should("have.attr", "id", "awesome-title");
    });
  });
});
