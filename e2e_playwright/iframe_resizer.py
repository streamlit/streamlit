import streamlit as st
def apply_heritage_theme(image_url):
    # تنسيق الـ CSS المخصص للهوية السعودية الفاخرة
    st.markdown(
        f"""
        <style>
        /* ضبط خلفية الصفحة بالكامل مع صورة الدرعية */
        .stApp {{
            background: linear-gradient(rgba(0, 0, 0, 0.75), rgba(0, 0, 0, 0.75)), 
                        url("{image_url}");
            background-size: cover;
            background-position: center;
            background-attachment: fixed; /* تأثير Parallax ثبات الخلفية */
        }}

        /* تنسيق النصوص والعناوين باللون الذهبي الملكي */
        h1, h2, h3, .stMarkdown p {{
            color: #D4AF37 !important; /* لون ذهبي */
            font-family: 'Tajawal', sans-serif;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }}

        /* جعل الحاويات (Cards) سوداء شفافة فخمة */
        .stMarkdown, div[data-testid="stVerticalBlock"] > div {{
            background-color: rgba(0, 0, 0, 0.6);
            border-radius: 15px;
            padding: 20px;
            border: 1px solid #D4AF37; /* إطار ذهبي نحيف */
        }}
        /* تحسين شكل الأزرار */
        .stButton>button {{
            background-color: #D4AF37 !important;
            color: black !important;
            border-radius: 8px;
            font-weight: bold;
            border: none;
        }}
        </style>
        """,
        unsafe_allow_html=True
    )
# --- طريقة الاستخدام ---
# استبدل الرابط أدناه برابط مباشر لصورة الدرعية التي تملكها
DIRIYAH_IMAGE_URL = "https://your-image-link.com/diriyah.jpg"
apply_heritage_theme(DIRIYAH_IMAGE_URL)
