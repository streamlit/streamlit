function getIframeBody(index) {
  return cy
    .getIndexed(".element-container > iframe", index)
    .should(iframe => {
      // Wait for a known element of the iframe to exist. In this case,
      // we wait for its button to appear. This will happen after the
      // handshaking with Streamlit is done.
      expect(iframe.contents().find("button")).to.exist;
    })
    .then(iframe => {
      // Return a snapshot of the iframe's body, now that we know it's
      // loaded.
      return cy.wrap(iframe.contents().find("body"));
    });
}

// These tests are run against both of our templates. One uses React, and
// the other is pure Typescript, but both should produce identical results.
describe("Component template", () => {
  beforeEach(() => {
    cy.loadApp("http://localhost:3000/");

    cy.prepForElementSnapshots();
  });

  it("is rendered correctly", () => {
    cy.get(".element-container > iframe").should("have.length", 2);

    getIframeBody(0)
      .find("button")
      .should("have.text", "Click Me!");
    getIframeBody(1)
      .find("button")
      .should("have.text", "Click Me!");

    cy.get(".element-container > iframe").each((el, idx) => {
      return cy
        .wrap(el)
        .matchImageSnapshot(
          "iframe-" + Cypress.env("COMPONENT_TEMPLATE_TYPE") + idx
        );
    });

    cy.get(".element-container > .stMarkdown p").each(el => {
      expect(el.text()).to.eq("You've clicked 0 times!");
    });
  });

  it("sends data back to Streamlit", () => {
    getIframeBody(0)
      .find("button")
      .click();

    cy.get(".element-container > .stMarkdown p")
      .eq(0)
      .should("have.text", "You've clicked 1 times!");
  });
});
