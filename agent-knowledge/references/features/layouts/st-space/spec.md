---
status: stable
last_updated: 2025-11-05
---

# Summary

Add a new command `st.space` that can add vertical or horizontal space.

---

# Problem statement

- There are 2 problems here:

  1. **Adding (mostly horizontal) space inside of complex layouts built with [Flex layout](https://www.notion.so/Flex-layout-2526cbf752e648758f9e917ce7a35a78?pvs=21).**

     - See two examples below. While it’s possible to build these layouts without `st.space` (e.g. by using nested containers in the 1st screenshot or setting `width="stretch"` for “Accept” in the 2nd screenshot), it’s often easier to just use `st.space` here.

       ![Screenshot 2025-03-25 at 20.40.37.png](attachment:57bce695-f7f4-4690-bfec-2027418de79d:Screenshot_2025-03-25_at_20.40.37.png)

       ![Screenshot 2025-03-25 at 20.41.08.png](attachment:f679adcd-adda-425c-819e-674328fc5856:Screenshot_2025-03-25_at_20.41.08.png)

     - Note that both of these examples need the width of `st.space` to fill the remaining space, i.e. use `"stretch"` as described in [Flex layout](https://www.notion.so/Flex-layout-2526cbf752e648758f9e917ce7a35a78?pvs=21). I think that’s the case for the majority of these use cases.

  2. **Adding vertical space to an app.**
     - We try to use good-looking amounts of padding and gap everywhere in Streamlit. But sometimes you still just want a bit of additional space between elements. I don’t think there’s a good way to handle this automatically in every situation.
     - Users are mostly using `st.write("")` to achieve this today ([10k search results on GitHub](https://github.com/search?q=st.write%28%22%22%29+language%3APython&type=code&l=Python)!). But that’s annoying since a) it’s not very obvious to new users (see forum questions [here](https://discuss.streamlit.io/t/how-to-add-extra-lines-space/2220) and [here](https://discuss.streamlit.io/t/create-empty-space-to-separate-portions-of-the-app/8689) with 70k views total), b) you can’t finely control the amount of space, and c) to add more than one line of space, you need to write this multiple times.
     - There’s also an extra [add_vertical_space](https://arnaudmiribel.github.io/streamlit-extras/extras/add_vertical_space/). Today it has 0.3% adoption but it used to be up to 1%.
     - For this use case, I’d love it if you could just put `st.space()` into your app to add a small amount of space, without needing to think about parameters or how much space you want.

## Metrics impact

- Given the [usage numbers of the add_vertical_space extra](https://www.notion.so/Spec-1c17170bb4168089aed3f784f675c753?pvs=21) + the fact that this will be more useful once we release flex layout, I’d expect this to have somewhere between 1-5% of adoption.

---

# Proposed solution

## API

- **Option 2: `st.space(size)` with default set to a fixed size** ✅ **PREFERRED**
  - Great for problem 2. You can just put `st.space` into your app and it creates a small amount of space. If you need more, you can specify the size.
  - A bit more work for problem 1 since you need to set `st.space("stretch")`. But I feel like this is not unexpected.
  - This should work in a way where if it’s in a vertical layout, it turns `size` into the element’s height. And if in a horizontal layout, it turns `size` into width.
  - Also, I think we should make `size` a positional parameter, so you can simply do `st.space(100)` instead of `st.space(size=100)`.
  - In addition to pixel values, we should also add the following literals: `size="small"|"medium"|"large"`
    - `"small"`: equals the height of a widget label minus the gap → **0.75rem**
      - This can be used to easily align buttons with labeled widgets or labeled widgets with non-labeled widgets.
    - `"medium"`: equals the height of a button/input field → **2.5rem**
    - `“large”`: equals the height of an input widget with label and large widgets e.g. audio*input without a label → **4.25rem** - Using `st.space("small")` + `st.space("large")` equals the height of a large widget with label.
      \*\** DEV NOTE: here we should add a new widthConfig option for rem so that we can translate these to rem in the python code and then style with rem in the FE. \_\*\*
  - Default should be `"small"`.
