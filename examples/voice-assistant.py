import streamlit as st
import pywhatkit
import speech_recognition as sr
import pyttsx3
import os
import webbrowser
import datetime
import wikipedia

st.markdown(
    """
    <style>
    .centered {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 90vh;
    }
    .btn-primary {
        background-color: #FF5722;
        color: white;
        font-weight: bold;
        padding: 10px 10px;
        border-radius: 5px;
        border: none;
        cursor: pointer;
    }
    .title {
        text-align: center;
        color: #FF5722;
        font-size: 500px;
        margin-bottom: 40px;
    }
    .footer {
        text-align: center;
        margin-top: 50px;
        color: #888888;
    }
    </style>
    """,
    unsafe_allow_html=True
)


# ask the question you want to ask
def speak(text):
    engine = pyttsx3.init()
    # You can adjust the speech rate (words per minute)
    engine.setProperty("rate", 150)  
    engine.say(text)
    engine.runAndWait()


# your speech is an audio
def get_audio():
    recognizer = sr.Recognizer()
    with sr.Microphone() as source:
        st.info("Listening... Say something!")
        audio = recognizer.listen(source)
    try:
        text = recognizer.recognize_google(audio)
        st.write(f"You said: {text}")
        speak("You said " + text)
        # if you tell shutdown the system
        if text == "shutdown":
            shutdown_PC()
        return text
    except sr.UnknownValueError:
        st.warning("Sorry, I couldn't understand your speech. Please try again.")
        return ""
    except sr.RequestError:
        st.error("Sorry, there was an issue with the speech recognition service. Please try again later.")
        return ""


# user-defined function to shutdown the system
def shutdown_PC():
    os.system("shutdown /s /t 1")


# searches the text and displays the result
def search_and_display(text):
    pywhatkit.search(text)
    st.write(f"Searching for : {text} ...")
    speak("Searching for " + text)


# opens the provided URL in a web browser
def open_website(url):
    webbrowser.open(url)
    st.write(f"Opening website: {url}")
    speak("Opening website")


# gets the current date and time
def get_date_time():
    now = datetime.datetime.now()
    date = now.strftime("%A, %d %B %Y")
    time = now.strftime("%I:%M %p")
    st.write(f"Today is {date}")
    st.write(f"The current time is {time}")
    speak(f"Today is {date} and the current time is {time}")


# searches Wikipedia for the provided query and displays the summary
def search_wikipedia(query):
    try:
        result = wikipedia.summary(query, sentences=2)
        st.write(f"Wikipedia Summary for '{query}':")
        st.write(result)
        speak(f"According to Wikipedia, {result}")
    except wikipedia.exceptions.PageError:
        st.error("Sorry, no Wikipedia page found for the provided query.")
    except wikipedia.exceptions.DisambiguationError:
        st.error("Multiple Wikipedia pages found for the provided query. Please be more specific.")


# Streamlit app
st.title("Personal VoiceAssistant using Python")

col1, col2, col3 = st.columns(3)

with col2:
    if st.button("Start Listening", key="start"):
        text = get_audio()
        if text:
            search_and_display(text)

with st.expander("Additional Features"):
    selected_feature = st.selectbox("Select a feature", ("Open Website", "Get Date and Time", "Search Wikipedia"))
    if selected_feature == "Open Website":
        wesite_url = st.text_input("Enter the website URL")
        if st.button("Open Website"):
            open_website(wesite_url)
    elif selected_feature == "Get Date and Time":
        if st.button("Get Date and Time"):
            get_date_time()
    elif selected_feature == "Search Wikipedia":
        wikipedia_query = st.text_input("Enter your Wikipedia search query")
        if st.button("Search Wikipedia"):
            search_wikipedia(wikipedia_query)
st.markdown("---")

# Footer
st.markdown(
    """
    <div class="footer">
        Made with ❤️ by Anirudh
    </div>
    """,
    unsafe_allow_html=True
)