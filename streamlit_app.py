import streamlit as st
import pandas as pd
import numpy as np
from datetime import datetime
from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.units import inch
from reportlab.lib import colors

# ---------------------------
# STREAMLIT CONFIG
# ---------------------------
st.set_page_config(
    page_title="Stanmore Equipment Value Calculator",
    page_icon="💰",
    layout="centered"
)

# ---------------------------
# HEADER / INTRO
# ---------------------------
st.image("stanmore_logo.png", width=180)  # <-- place stanmore_logo.png in same folder
st.title("💰 Stanmore Equipment Value Calculator")
st.write("""
Estimate the **fair market value (CAD)** of used construction or material-handling equipment.  
Receive a downloadable PDF valuation report branded for **Stanmore Equipment**.
""")

# ---------------------------
# SIDEBAR
# ---------------------------
with st.sidebar:
    st.header("ℹ️ About")
    st.write("""
    This calculator estimates resale and trade-in values based on 
    **age, condition, and hours of use**, tailored for Canadian market conditions.
    """)
    st.markdown("---")
    st.write("**Stanmore Equipment Ltd.**")
    st.write("📍 123 Industrial Park Rd, Toronto, ON")
    st.write("📞 (416) 555-0123")
    st.write("🌐 www.stanmoreequipment.com")

# ---------------------------
# INPUT FORM
# ---------------------------
st.subheader("Enter Equipment Details")

with st.form("value_form"):
    col1, col2 = st.columns(2)
    with col1:
        equipment_type = st.selectbox(
            "Equipment Type",
            ["Forklift", "Scissor Lift", "Loader", "Excavator", "Telehandler", "Boom Lift", "Other"]
        )
        make = st.text_input("Make / Brand", "Toyota")
        model = st.text_input("Model", "8FGU25")
        year = st.number_input("Year of Manufacture", min_value=1990, max_value=datetime.now().year, value=2019)
    with col2:
        hours = st.number_input("Hours of Use", min_value=0, max_value=25000, value=4200)
        condition = st.selectbox("Condition", ["Excellent", "Good", "Fair", "Needs Repair"])
        region = st.text_input("Region / Province", "Ontario")
        features = st.text_area("Additional Features", placeholder="e.g. Side-shift, 4WD, diesel")

    submitted = st.form_submit_button("🔍 Calculate Value")

# ---------------------------
# VALUATION LOGIC (CAD)
# ---------------------------
def estimate_value(equipment_type, make, model, year, hours, condition, region):
    current_year = datetime.now().year
    age = current_year - year

    # Base new prices (CAD)
    base_prices = {
        "Forklift": 55000,
        "Scissor Lift": 32000,
        "Loader": 135000,
        "Excavator": 180000,
        "Telehandler": 110000,
        "Boom Lift": 85000,
        "Other": 60000
    }
    base_price = base_prices.get(equipment_type, 60000)

    depreciation_rate = 0.12
    value_after_depreciation = base_price * ((1 - depreciation_rate) ** age)
    value_after_depreciation = max(value_after_depreciation, base_price * 0.2)

    if hours > 10000:
        value_after_depreciation *= 0.75
    elif hours > 7000:
        value_after_depreciation *= 0.85
    elif hours > 4000:
        value_after_depreciation *= 0.9

    condition_factors = {
        "Excellent": 1.05,
        "Good": 1.0,
        "Fair": 0.85,
        "Needs Repair": 0.6,
    }
    adjusted_value = value_after_depreciation * condition_factors[condition]

    region_modifiers = {
        "Ontario": 1.0,
        "Alberta": 1.05,
        "British Columbia": 1.1,
        "Quebec": 0.95
    }
    region_modifier = region_modifiers.get(region, 1.0)

    final_value = adjusted_value * region_modifier
    trade_in_value = final_value * 0.9
    retail_value = final_value * 1.1

    if hours < 3000 and condition in ["Excellent", "Good"]:
        confidence = "High"
    elif hours < 8000:
        confidence = "Medium"
    else:
        confidence = "Low"

    return {
        "final_value": round(final_value, 2),
        "trade_in_value": round(trade_in_value, 2),
        "retail_value": round(retail_value, 2),
        "confidence": confidence,
        "age": age,
        "base_price": base_price
    }

# ---------------------------
# PDF GENERATION
# ---------------------------
def generate_pdf(data, logo_path="stanmore_logo.png"):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=letter)
    width, height = letter

    # Header
    if logo_path:
        try:
            c.drawImage(logo_path, 40, height - 80, width=120, preserveAspectRatio=True, mask='auto')
        except:
            pass

    c.setFont("Helvetica-Bold", 14)
    c.drawString(180, height - 60, "Stanmore Equipment Valuation Report")

    # Line
    c.setStrokeColor(colors.grey)
    c.line(40, height - 90, width - 40, height - 90)

    # Equipment details
    c.setFont("Helvetica", 11)
    y = height - 120
    c.drawString(50, y, f"Equipment: {data['year']} {data['make']} {data['model']} ({data['equipment_type']})")
    y -= 18
    c.drawString(50, y, f"Condition: {data['condition']}   |   Hours Used: {data['hours']:,}   |   Region: {data['region']}")
    y -= 18
    c.drawString(50, y, f"Additional Features: {data['features'] or 'N/A'}")

    # Values
    y -= 35
    c.setFont("Helvetica-Bold", 12)
    c.drawString(50, y, "Valuation Summary (CAD):")
    y -= 20
    c.setFont("Helvetica", 11)
    c.drawString(70, y, f"Estimated Market Value: ${data['final_value']:,.0f}")
    y -= 16
    c.drawString(70, y, f"Trade-In Value: ${data['trade_in_value']:,.0f}")
    y -= 16
    c.drawString(70, y, f"Retail Range: ${data['retail_value']*0.95:,.0f} – ${data['retail_value']*1.05:,.0f}")
    y -= 20
    c.drawString(70, y, f"Confidence Level: {data['confidence']}")
    y -= 20
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(50, y, f"Base new price reference: ${data['base_price']:,.0f}   |   Estimated age: {data['age']} years")

    # Footer
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.grey)
    c.drawString(40, 40, "Stanmore Equipment Ltd. • 123 Industrial Park Rd, Toronto, ON • (416) 555-0123 • www.stanmoreequipment.com")

    c.showPage()
    c.save()
    buffer.seek(0)
    return buffer

# ---------------------------
# DISPLAY RESULTS
# ---------------------------
if submitted:
    results = estimate_value(equipment_type, make, model, year, hours, condition, region)
    st.success("✅ Valuation Complete")

    st.subheader("📊 Valuation Report")
    st.markdown(f"""
    **Equipment:** {year} {make} {model} ({equipment_type})  
    **Condition:** {condition}  
    **Hours Used:** {hours:,}  
    **Region:** {region}  
    """)

    st.metric("Estimated Market Value", f"${results['final_value']:,.0f} CAD")
    st.metric("Trade-In Value", f"${results['trade_in_value']:,.0f} CAD")
    st.metric("Retail Range", f"${results['retail_value']*0.95:,.0f} – ${results['retail_value']*1.05:,.0f} CAD")
    st.markdown(f"**Confidence Level:** {results['confidence']}")

    st.markdown("---")
    st.caption(f"Base new price reference: ${results['base_price']:,.0f} • Estimated age: {results['age']} years")

    # Depreciation Chart
    st.subheader("📉 Estimated Depreciation Curve")
    years = np.arange(0, 15)
    values = results['base_price'] * ((1 - 0.12) ** years)
    df = pd.DataFrame({"Years Since New": years, "Estimated Value (CAD)": values})
    st.line_chart(df, x="Years Since New", y="Estimated Value (CAD)", use_container_width=True)

    # Prepare PDF data
    pdf_data = {
        "equipment_type": equipment_type,
        "make": make,
        "model": model,
        "year": year,
        "hours": hours,
        "condition": condition,
        "region": region,
        "features": features,
        **results
    }

    pdf_file = generate_pdf(pdf_data)
    st.download_button(
        label="📄 Download Valuation Report (PDF)",
        data=pdf_file,
        file_name=f"Stanmore_Valuation_{make}_{model}.pdf",
        mime="application/pdf"
    )
