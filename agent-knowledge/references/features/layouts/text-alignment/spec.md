---
status: stable
last_updated: 2025-11-05
---

# Summary

Configure text alignment for all text elements.

**Implementation Plan**: See `TEXT_ALIGNMENT_IMPLEMENTATION_PLAN.md` for detailed technical implementation guide.

---

# Problem statement

- We recently allowed aligning elements via `st.container(..., horizontal_alignment="left"|"center"|"right"|"distribute")`. See [Flex layout](https://www.notion.so/Flex-layout-2526cbf752e648758f9e917ce7a35a78?pvs=21). This allows you to e.g. center align a Markdown block:

  ![Screenshot 2025-08-20 at 01.08.20.png](attachment:ec9e506f-fee4-43e9-9d40-51c00727e452:Screenshot_2025-08-20_at_01.08.20.png)

- But the text _itself_ is still left-aligned. To allow true center/right-aligned text, we need to add text alignment.
- (47 👍) https://github.com/streamlit/streamlit/issues/4109

---

# Proposed solution

## API

- Add a keyword-only arg `text_alignment="left"|"center"|"right"|"justify"` (default: "left") to the following commands:
  - st.markdown
  - st.text
  - st.caption
  - st.title, st.header, subheader → could also leave out the headers but I guess sooner or later someone will ask for it, so might make sense to just do it right away
- Alternatives
  - Use `alignment` instead of `text_alignment` → I think using the word `text` here makes it a bit clearer what this is, especially in comparison to the (item) alignment of `st.container`
  - Use `"distributed"` instead of `"justify"` → this would be a bit more in line with `st.container` but seem like for text “justify”/”justification” is very much the standard terminology ([Wikipedia](https://en.wikipedia.org/wiki/Typographic_alignment#Justified); Word and Google Docs; ChatGPT) plus it describes very specifically that the first N-1 lines are stretched to align on the left and right side but the last line is left-aligned
  - Add it to `st.latex` as well → doesn’t seem worth it, `st.latex` is used very rarely anyway and I don’t think there are lots of cases where you’d want an equation left- or right-aligned

## Default width of text elements

- Currently, all of the text elements mentioned above have `width="stretch"` by default, except for `st.text`, which has `width="content"` by default.
- We kept `width="stretch"` for now to not break existing Markdown elements that need to stretch, especially dividers and code blocks. This is pretty annoying in horizontal containers though (you very often need to manually set `width="content"`) and it’s confusing (see [GitHub issue](https://github.com/streamlit/streamlit/issues/12127) and [Fanilo’s video at 11:35](https://youtu.be/6wEPA9Z36yA?si=f1pDaeKAX3kj7GPs&t=695)).
- So we were thinking about two options:
  1. Set `width="auto"` by default, which would set `width="stretch"` in vertical containers and `width="content"` in horizontal containers. ✅ **SELECTED**
  2. Set `width="auto"` by default, which would set `width="stretch"` for elements that contain a divider or code block and `width="content"` otherwise.
- Text alignment makes this even more complicated now. If the text element is set to `width="content"` by default and is smaller than one full line, setting `text_alignment="center"|"right"` basically doesn’t have any effect (since the text would just be aligned _within_ the text element, which has the same width as the text itself).
- To make it more concrete, I think here are all the problematic examples we’re talking about:

  1. Small text in a horizontal container. In the example below, I’d expect the button to be right next to the text. For this, the markdown element needs `width="content"`.

     ```python
     with st.container(horizontal=True):
         st.markdown("Click here:")
         st.button("Button")
     ```

  2. Dividers and code blocks. In the example below, I’d expect the divider and code block to stretch to the container width and not just have the width of the text above/below. For this, the markdown element needs `width="stretch"`. Note that breaking this behavior would affect a lot of existing apps.

     ````python
     st.markdown("""
     Here is a divider:

     ---

     Here is a code block:

     ```python
     a = 123
     ````

     """)

     ```

     ```

  3. Small text with `text_alignment`. In the example below, I’d expect the text to be center-aligned. For this, the markdown element needs `width="stretch"`.

     ```python
     st.markdown("Test text", text_alignment="center")
     ```

  4. Small text in a container with `horizontal_alignment`. In the example below, I’d expect the text element to be center-aligned. For this, the markdown element needs `width="content"`. That’s [this GitHub issue](https://github.com/streamlit/streamlit/issues/12127).

     ```python
     with st.container(horizontal_alignment="center"):
         st.markdown("Test text")
     ```

- [Option 1](https://www.notion.so/Spec-2547170bb41680859f39c0f1f7f03993?pvs=21) would solve examples a, b, c but break example d (the text would be left-aligned since the text element has a stretch width).
  [Option 2](https://www.notion.so/Spec-2547170bb41680859f39c0f1f7f03993?pvs=21) would solve examples a, b, d but break example c (the text would be left-aligned since the text element has a content width).
- I think I prefer option 1 and breaking example d since:
  - Example c seems like a more common thing to do.
  - Example d is something slightly more advanced, so I think it might be easier to fix for the devs using this (assuming that if you know about containers and horizontal alignment, you probably also know about the `width` parameter).
- I don’t think we can solve all of these 4 examples automatically unless we do a super complex default behavior that is hard to explain (and might end up being even more confusing).
