describe("st.header", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays correct number of header elements", () => {
    cy.get(".element-container .stMarkdown h2").should("have.length", 2);
  });

  it("displays correct number of title elements", () => {
    cy.get(".element-container .stMarkdown h1").should("have.length", 2);
  });

  it("displays correct number of subheader elements", () => {
    cy.get(".element-container .stMarkdown h2").should("have.length", 2);
  });

  it("displays a header", () => {
    cy.get(".element-container .stMarkdown h2").then(els => {
      expect(els[0].textContent).to.eq("This header is awesome!");
      expect(els[1].textContent).to.eq("This header is awesome too!");
    });
  });

  it("displays headers with anchors", () => {
    cy.get(".element-container .stMarkdown h2").then(els => {
      cy.wrap(els[0]).should("have.attr", "id", "this-header-is-awesome");
      cy.wrap(els[1]).should("have.attr", "id", "awesome-header");
    });
  });

  it("displays markdown properly after a new line", () => {
    cy.get(".element-container .stMarkdown")
      .first()
      .find("a")
      .should("have.attr", "href");
  })
});
