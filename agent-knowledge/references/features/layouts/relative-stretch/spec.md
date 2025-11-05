---
status: stable
last_updated: 2025-11-05
---

# Summary

Add a way to define how much space each element should consume relative to other elements, if all of them have `width="stretch"` (or `height="stretch"`).

---

# Problem statement

- With [Flex layout](https://www.notion.so/Flex-layout-2526cbf752e648758f9e917ce7a35a78?pvs=21), we added `width="stretch"` and `height="stretch"` to many elements. This means that an element will stretch to fill the available space in the parent container.
- If there are multiple elements with `"stretch"` in a container, they will take up the same width/height. But in some situations you want to distribute the available space in an uneven way, e.g. make element A take up twice the space as element B.
- (2 👍) https://github.com/streamlit/streamlit/issues/11715

---

# Proposed solution

## API

- **Option 1: `width="stretch", scale=N` (i.e. new parameter)**
  - This is what Gradio does.
  - This means we’d need to add an additional parameter to almost every element, even though usage will likely be very low, since you only need this in rare situations.
- **Option 2: `width="stretch:N"`** ✅ **PREFERRED**

  - Similar to [Support Google Fonts in theming](https://www.notion.so/Support-Google-Fonts-in-theming-23f7170bb41680dab5fbe9063c4bf3cb?pvs=21) (`font="Inter:link/to/google/fonts"`). Note that we can still change that API until September 17, 2025 since it’s not released.
  - Example

    ```python
    st.element1(width="stretch")
    st.element2(width="stretch:2")
    ```

- **Option 3: `width="stretch/N"`**
  - Similar to Material icons, e.g. `:material/star:`
- **Option 4: `width=("stretch", N`**

Other notes:

- I think `N` should be an integer or a float (i.e. you can do `width="stretch:1.5"`).
- `width="stretch:1"` should be equivalent to `width="stretch"`.

## Behavior

- If only one element in the container has `N` set, it should behave just like `width="stretch"` (i.e. `N=1`) regardless of the value of `N`.
- If multiple elements have `N` set, it should distribute the space among them. E.g. if the parent container is 600px wide, element A has `width="stretch:2"` and element B has `width="stretch:1"` (or `width="stretch"`), then element A should be 400px wide and element B should be 200px wide.
  - Note that this is the same way it works in `st.columns`, e.g. if you do `col1, col2 = st.columns([2, 1])`, then `col1` will be twice as wide as `col1`.
- Same for `height`.
