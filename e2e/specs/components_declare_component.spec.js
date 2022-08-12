describe("components.declare_component", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("sets `src` correctly", () => {
    cy.get("iframe").should(
      "have.attr",
      "src",
      "http://not.a.real.url?streamlitUrl=http%3A%2F%2Flocalhost%3A3000%2F"
    );
  });

  it("sets `title` correctly", () => {
    cy.get("iframe").should(
      "have.attr",
      "title",
      "components_declare_component.test_component"
    );
  });
});
