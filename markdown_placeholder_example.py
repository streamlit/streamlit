#!/usr/bin/env python3
"""
Example script demonstrating Markdown support in st.selectbox placeholder parameter.

This script shows how Markdown formatting works in the placeholder text of selectbox widgets.
"""

import streamlit as st

st.title("🎯 Markdown Support in Selectbox Placeholders")

st.markdown("""
This demo shows how Markdown formatting is now supported in the `placeholder` parameter 
of `st.selectbox()` (and potentially other widgets).
""")

# Example 1: Basic markdown formatting in placeholder
st.header("Example 1: Basic Markdown Formatting")
st.code('''
options = ["Option A", "Option B", "Option C"]
placeholder = "**Choose** an _option_ from the `dropdown` above"
st.selectbox("Basic Markdown", options, placeholder=placeholder, index=None)
''')

options = ["Option A", "Option B", "Option C"]
placeholder = "**Choose** an _option_ from the `dropdown` above"
selectbox1 = st.selectbox(
    "Basic Markdown", 
    options, 
    placeholder=placeholder, 
    index=None,
    key="basic_markdown"
)

# Example 2: Icons and emojis in placeholder
st.header("Example 2: Icons and Emojis")
st.code('''
placeholder = ":material/search: Search for an option 🔍"
st.selectbox("Icons & Emojis", options, placeholder=placeholder, index=None)
''')

placeholder_icons = ":material/search: Search for an option 🔍"
selectbox2 = st.selectbox(
    "Icons & Emojis", 
    options, 
    placeholder=placeholder_icons, 
    index=None,
    key="icons_emoji"
)

# Additional comprehensive examples
st.header("📚 More Advanced Examples")

# Example 3: Color and background formatting
st.subheader("Color and Background Support")
st.code('''
placeholder = ":blue[Select] a :red-background[priority] level"
st.selectbox("Priority Levels", ["Low", "Medium", "High"], 
             placeholder=placeholder, index=None)
''')

priority_placeholder = ":blue[Select] a :red-background[priority] level"
selectbox3 = st.selectbox(
    "Priority Levels", 
    ["Low", "Medium", "High"], 
    placeholder=priority_placeholder, 
    index=None,
    key="priority_levels"
)

# Example 4: Combining multiple markdown elements
st.subheader("Complex Formatting")
st.code('''
placeholder = "**Choose** _your_ `framework`: :material/code: or :green[skip]"
st.selectbox("Development Framework", 
             ["React", "Vue", "Angular", "Svelte"], 
             placeholder=placeholder, index=None)
''')

complex_placeholder = "**Choose** _your_ `framework`: :material/code: or :green[skip]"
selectbox4 = st.selectbox(
    "Development Framework", 
    ["React", "Vue", "Angular", "Svelte"], 
    placeholder=complex_placeholder, 
    index=None,
    key="dev_framework"
)

# Example 5: Real-world scenario
st.subheader("Real-world Example")
st.code('''
placeholder = ":material/search: **Search** for a _country_ or :gray[leave empty]"
countries = ["USA", "Canada", "UK", "Germany", "France", "Japan"]
st.selectbox("Country Selection", countries, 
             placeholder=placeholder, index=None)
''')

search_placeholder = ":material/search: **Search** for a _country_ or :gray[leave empty]"
countries = ["USA", "Canada", "UK", "Germany", "France", "Japan"]
selectbox5 = st.selectbox(
    "Country Selection", 
    countries, 
    placeholder=search_placeholder, 
    index=None,
    key="country_selection"
)

# Show selected values
if any([selectbox1, selectbox2, selectbox3, selectbox4, selectbox5]):
    st.header("📋 Selected Values")
    values = {
        "Basic Markdown": selectbox1,
        "Icons & Emojis": selectbox2, 
        "Priority Levels": selectbox3,
        "Dev Framework": selectbox4,
        "Country": selectbox5
    }
    
    for label, value in values.items():
        if value:
            st.success(f"**{label}**: {value}")

# Technical notes
st.header("📝 Technical Implementation")
st.markdown("""
### How it works:
1. **Detection**: The placeholder component checks if the text contains Markdown syntax patterns
2. **Rendering**: If Markdown is detected, it uses `StreamlitMarkdown` component with `isLabel=True`
3. **Fallback**: Plain text is rendered normally for backward compatibility
4. **Styling**: Inherits font styling from the parent component

### Supported Markdown Features:
- **Bold** and *italic* text
- `Inline code`
- :material/icon: Material icons  
- 🎯 Emojis
- :blue[Colored text] and :red-background[background colors]
- Small badges and formatting

### Limitations:
- Links are disabled in placeholder context
- Block elements (headers, lists) are not supported
- Limited to inline formatting only
""")

# Add some spacing
st.markdown("---")
st.caption("Demo of Markdown support in selectbox placeholders")
