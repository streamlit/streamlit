# 🎨 streamlit-modelslab

**Professional AI image generation for Streamlit applications**

Transform your Streamlit apps with powerful AI image generation using ModelsLab's cutting-edge models including Flux, Stable Diffusion XL, and Playground v2.5.

[![PyPI version](https://badge.fury.io/py/streamlit-modelslab.svg)](https://badge.fury.io/py/streamlit-modelslab)
[![Downloads](https://pepy.tech/badge/streamlit-modelslab)](https://pepy.tech/project/streamlit-modelslab)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.8+](https://img.shields.io/badge/python-3.8+-blue.svg)](https://www.python.org/downloads/)

## ✨ Features

- **13+ AI Models**: Flux, SDXL, Playground v2.5, Stable Diffusion, and more
- **One-Line Generation**: `ml.generate_image("your prompt")` 
- **Rich UI Components**: Complete settings panels, cost calculators, batch generators
- **Smart Prompting**: Automatic prompt enhancement and validation
- **Cost Optimization**: Built-in cost estimation and batch optimization
- **Async Processing**: Progress bars for long-running generations
- **Error Handling**: Graceful failures with detailed error messages
- **Production Ready**: Secure API key management and caching

## 🚀 Quick Start

### Installation

```bash
pip install streamlit-modelslab
```

### Get API Key

1. Sign up at [ModelsLab](https://modelslab.com/signup)
2. Get your API key from [Dashboard](https://modelslab.com/dashboard/api-keys)
3. Add to your Streamlit secrets or environment variables

### Basic Usage

```python
import streamlit as st
import streamlit_modelslab as ml

st.title("🎨 AI Image Generator")

# Configure API key (one-time setup)
with st.sidebar:
    ml.settings_panel()

# Generate image with one line
image_url = ml.generate_image("A futuristic city at sunset, cyberpunk style")

if image_url:
    st.image(image_url, caption="Generated with ModelsLab")
```

### Complete UI Example

```python
import streamlit as st
import streamlit_modelslab as ml

st.set_page_config(page_title="AI Image Studio", page_icon="🎨")

st.title("🎨 AI Image Studio")
st.markdown("*Powered by ModelsLab*")

# Sidebar settings
with st.sidebar:
    ml.settings_panel()
    selected_model = ml.model_selector()

# Main interface
col1, col2 = st.columns([3, 1])

with col1:
    # Full-featured image generator UI
    generated_url = ml.image_generator_ui(key="main_generator")

with col2:
    if generated_url:
        # Cost calculator
        ml.cost_calculator(model=selected_model, num_images=1)

# Batch generation
st.header("🔄 Batch Generator")
batch_urls = ml.batch_generator_ui(max_images=6)

if batch_urls:
    # Image gallery
    ml.image_gallery(batch_urls, columns=3)
```

## 📚 API Reference

### Core Functions

#### `generate_image(prompt, model="flux", **kwargs)`

Generate a single image from text prompt.

**Parameters:**
- `prompt` (str): Text description of the image
- `model` (str): AI model to use (`"flux"`, `"sdxl"`, `"playground-v2"`, etc.)
- `negative_prompt` (str, optional): What to avoid in the image
- `width` (int): Image width (default: 1024)
- `height` (int): Image height (default: 1024)
- `steps` (int): Generation steps (default: 25)
- `guidance_scale` (float): Prompt adherence (default: 7.5)

**Returns:** `str` - URL of generated image

**Example:**
```python
image_url = ml.generate_image(
    "A serene mountain lake at dawn",
    model="flux",
    negative_prompt="blur, distortion",
    width=1280,
    height=720,
    steps=30
)
```

#### `generate_batch(prompts, model="flux", **kwargs)`

Generate multiple images efficiently.

**Parameters:**
- `prompts` (List[str]): List of text prompts
- `model` (str): AI model to use
- Additional kwargs same as `generate_image`

**Returns:** `List[str]` - URLs of generated images

**Example:**
```python
prompts = [
    "A red sports car",
    "A blue ocean wave", 
    "A green forest path"
]

image_urls = ml.generate_batch(prompts, model="sdxl")
```

### UI Components

#### `settings_panel()`

Complete settings panel with API key management and model information.

```python
with st.sidebar:
    ml.settings_panel()
```

#### `model_selector(key="modelslab_model", default="flux")`

Model selection dropdown with cost and performance info.

```python
selected_model = ml.model_selector(default="flux")
```

#### `image_generator_ui(key="generator", advanced_options=True)`

Full-featured image generation interface with all controls.

```python
image_url = ml.image_generator_ui(
    key="my_generator",
    advanced_options=True
)
```

#### `batch_generator_ui(key="batch", max_images=10)`

Batch generation interface with cost optimization.

```python
image_urls = ml.batch_generator_ui(max_images=5)
```

#### `image_gallery(image_urls, captions=None, columns=3)`

Display multiple images in a grid layout.

```python
ml.image_gallery(
    image_urls=['url1', 'url2', 'url3'],
    captions=['Image 1', 'Image 2', 'Image 3'],
    columns=2
)
```

### Utility Functions

#### `estimate_cost(model, num_images)`

Calculate generation costs.

```python
cost = ml.estimate_cost("flux", 5)  # Cost for 5 images
st.write(f"Estimated cost: ${cost:.3f}")
```

#### `get_available_models()`

Get all available models with details.

```python
models = ml.get_available_models()
for model_id, info in models.items():
    st.write(f"{info['name']}: ${info['cost_per_image']:.3f}")
```

## 🎯 Available Models

| Model | Description | Speed | Cost | Best For |
|-------|-------------|-------|------|----------|
| **Flux** | Latest SOTA model | ~30s | $0.018 | Professional, detailed images |
| **SDXL** | Stable Diffusion XL | ~15s | $0.015 | General purpose, artistic |
| **Playground v2.5** | Aesthetic-focused | ~20s | $0.012 | UI mockups, clean designs |
| **Stable Diffusion** | Classic model | ~10s | $0.008 | Quick iterations, concepts |

[View all 13+ models](https://docs.modelslab.com)

## 🔧 Configuration

### API Key Methods

**Method 1: Streamlit Secrets** (Recommended for deployment)
```toml
# .streamlit/secrets.toml
MODELSLAB_API_KEY = "your-api-key-here"
```

**Method 2: Environment Variable**
```bash
export MODELSLAB_API_KEY="your-api-key-here"
```

**Method 3: UI Settings Panel**
```python
with st.sidebar:
    ml.settings_panel()  # Interactive key input
```

### Advanced Configuration

```python
# Custom API base URL (for enterprise)
ml.configure_api_key("your-key", base_url="https://api.enterprise.modelslab.com")

# Custom generation parameters
custom_params = {
    "width": 1536,
    "height": 1024,
    "steps": 50,
    "guidance_scale": 12.0,
    "enhance_prompt": True,
    "safety_checker": True
}

image_url = ml.generate_image("A landscape", **custom_params)
```

## 💡 Examples

### Creative App

```python
import streamlit as st
import streamlit_modelslab as ml

st.title("🎨 Creative AI Studio")

# Style selector
style = st.selectbox("Art Style", [
    "Photorealistic",
    "Oil Painting", 
    "Digital Art",
    "Watercolor",
    "Cyberpunk"
])

# Subject input
subject = st.text_input("What do you want to create?", "A majestic lion")

if st.button("🎨 Create Art"):
    prompt = f"{subject}, {style.lower()} style, masterpiece quality"
    
    with st.spinner("Creating your masterpiece..."):
        image_url = ml.generate_image(prompt, model="flux")
        
    if image_url:
        st.image(image_url, caption=f"{style} artwork")
        
        # Save button
        if st.button("💾 Save Image"):
            ml.save_image(image_url, prompt, "flux")
            st.success("Image saved locally!")
```

### E-commerce Mockups

```python
import streamlit as st
import streamlit_modelslab as ml

st.title("🛍️ Product Mockup Generator")

# Product details
product_name = st.text_input("Product Name", "Wireless Headphones")
product_color = st.selectbox("Color", ["Black", "White", "Blue", "Red"])
setting = st.selectbox("Setting", ["Studio", "Lifestyle", "Outdoor", "Office"])

if st.button("📸 Generate Mockup"):
    prompt = f"{product_color} {product_name}, {setting.lower()} photography, professional product shot, clean background"
    
    image_url = ml.generate_image(
        prompt,
        model="playground-v2",  # Great for clean product shots
        width=1024,
        height=1024
    )
    
    if image_url:
        col1, col2 = st.columns(2)
        
        with col1:
            st.image(image_url, caption="Generated Mockup")
        
        with col2:
            st.write("**Mockup Details:**")
            st.write(f"Product: {product_name}")
            st.write(f"Color: {product_color}")
            st.write(f"Setting: {setting}")
            st.write(f"Cost: ${ml.estimate_cost('playground-v2', 1):.3f}")
```

### Content Creation Pipeline

```python
import streamlit as st
import streamlit_modelslab as ml

st.title("📝 Content Creation Pipeline")

# Blog post input
blog_topic = st.text_area("Blog Topic/Outline", height=100)

if blog_topic and st.button("🖼️ Generate Visuals"):
    # Extract key concepts for images
    concepts = [
        f"Hero image for {blog_topic}",
        f"Infographic style illustration about {blog_topic}",
        f"Abstract concept representing {blog_topic}"
    ]
    
    # Generate batch of images
    with st.spinner("Generating content visuals..."):
        image_urls = ml.generate_batch(
            concepts,
            model="sdxl",
            width=1200,
            height=630  # Social media friendly
        )
    
    if image_urls:
        st.success(f"Generated {len(image_urls)} visuals!")
        
        # Display in gallery
        ml.image_gallery(
            image_urls,
            captions=["Hero Image", "Infographic", "Abstract"],
            columns=3
        )
        
        # Cost summary
        total_cost = ml.estimate_cost("sdxl", len(image_urls))
        st.info(f"Total generation cost: ${total_cost:.3f}")
```

## 🔍 Troubleshooting

### Common Issues

**"No API key found"**
- Add your API key via settings panel or environment variable
- Verify key is correct at [Dashboard](https://modelslab.com/dashboard/api-keys)

**Generation timeout**
- Large images (>1024px) take longer, wait patiently
- Check internet connection
- Try a faster model like "stable-diffusion"

**Poor image quality**
- Use more descriptive prompts
- Try "flux" model for best quality
- Increase steps (25-50) for better results
- Add quality terms: "high quality, detailed, professional"

**Cost concerns**
- Use `ml.estimate_cost()` before generation
- Try cheaper models like "stable-diffusion" 
- Use batch generation for efficiency

### Getting Help

- 📖 [Documentation](https://docs.modelslab.com)
- 💬 [Discord Community](https://discord.gg/modelslab)
- 🐛 [Report Issues](https://github.com/modelslab/streamlit-modelslab/issues)
- ✉️ Support: support@modelslab.com

## 🎯 Why ModelsLab?

### vs OpenAI DALL-E
- ✅ 13+ models vs 1
- ✅ $0.008-0.018 per image vs $0.020-0.080
- ✅ Higher resolution support (up to 1536px)
- ✅ No content restrictions
- ✅ Faster generation times

### vs Stability AI
- ✅ Simple HTTP API vs complex SDKs
- ✅ Managed infrastructure vs self-hosting
- ✅ Built-in Streamlit integration
- ✅ Transparent pricing

### vs Replicate
- ✅ Specialized for image generation
- ✅ Better Streamlit integration
- ✅ More predictable pricing
- ✅ Faster API responses

## 🏗️ Built With ModelsLab

Thousands of developers use ModelsLab for:

- **Creative Apps** - AI art generators, style transfer tools
- **E-commerce** - Product mockups, variant visualization  
- **Content Creation** - Blog illustrations, social media graphics
- **Education** - Visual learning aids, concept illustrations
- **Prototyping** - UI mockups, design iterations
- **Entertainment** - Character generation, scene creation

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
git clone https://github.com/modelslab/streamlit-modelslab
cd streamlit-modelslab
pip install -e ".[dev]"
pytest
```

## 📜 License

MIT License - see [LICENSE](LICENSE) for details.

## 🔗 Links

- 🏠 [ModelsLab Homepage](https://modelslab.com)
- 📖 [API Documentation](https://docs.modelslab.com)  
- 🎮 [Try the Playground](https://modelslab.com/playground)
- 💬 [Discord Community](https://discord.gg/modelslab)
- 🐙 [GitHub](https://github.com/modelslab)
- 🐦 [Twitter](https://twitter.com/modelslab)

---

**Made with ❤️ by the ModelsLab team**

*Transform your Streamlit apps with professional AI image generation*