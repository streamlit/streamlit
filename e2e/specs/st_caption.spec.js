describe("st.caption", () => {
  before(() => {
    cy.loadApp("http://localhost:3000/");
  });

  it("displays correct number of elements", () => {
    cy.get(
      ".element-container .stMarkdown [data-testid='stCaptionContainer']"
    ).should("have.length", 6);
  });

  it("matches snapshots", () => {
    cy.get(
      ".element-container .stMarkdown [data-testid='stCaptionContainer']"
    ).then(els => {
      cy.wrap(els.slice(1)).each((el, i) => {
        return cy.wrap(el).matchThemedSnapshots(`caption-${i}`);
      });
    });
  });

  it("displays correct content inside caption", () => {
    cy.get(
      ".element-container .stMarkdown [data-testid='stCaptionContainer']"
    ).then(els => {
      expect(els[1].textContent).to.eq("This is a caption!");
      expect(els[2].textContent).to.eq(
        "This is a caption that contains markdown inside it!"
      );
      cy.wrap(els[2])
        .get("em")
        .should("have.text", "caption");
      cy.wrap(els[2])
        .get("strong")
        .should("have.text", "markdown inside it");
      // html should be escaped when unsafe_allow_html=False
      expect(els[3].textContent).to.eq(
        "This is a caption that contains <div>html</div> inside it!"
      );
      // html should render when unsafe_allow_html=True
      expect(els[4].textContent).to.eq(
        "This is a caption that contains html inside it!"
      );
    });
  });

  it("matches snapshot in sidebar", () => {
    cy.get("[data-testid='stSidebar'] .stMarkdown").matchThemedSnapshots(
      `caption-in-sidebar`
    );
  });
});
