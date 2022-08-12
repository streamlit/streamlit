describe("st.echo", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("echos a code", () => {
    cy.get(".element-container .stMarkdown").should(
      "have.text",
      `print("This code is awesome!")`
    );
  });
});
