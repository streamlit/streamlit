describe("st.subheader", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays correct number of elements", () => {
    cy.get(".element-container .stMarkdown h3").should("have.length", 2);
  });

  it("displays a subheader", () => {
    cy.get(".element-container .stMarkdown h3").then(els => {
      expect(els[0].textContent).to.eq("This subheader is awesome!");
      expect(els[1].textContent).to.eq("This subheader is awesome too!");
    });
  });

  it("displays subheaders with anchors", () => {
    cy.get(".element-container .stMarkdown h3").then(els => {
      cy.wrap(els[0]).should("have.attr", "id", "this-subheader-is-awesome");
      cy.wrap(els[1]).should("have.attr", "id", "awesome-subheader");
    });
  });
});
