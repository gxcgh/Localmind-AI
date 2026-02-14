import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    print("Error: API Key not found")
    exit(1)

genai.configure(api_key=API_KEY)

try:
    print("Initializing model...")
    # This is the line from main.py
    model = genai.GenerativeModel('gemini-2.0-flash', tools='google_search_retrieval')
    print("Model initialized successfully.")

    print("Generating content...")
    response = model.generate_content(
        "What is the capital of India?",
        generation_config=genai.GenerationConfig(
            response_mime_type="application/json"
        )
    )
    print("Response generated:")
    print(response.text)

except Exception as e:
    print(f"CRASH: {e}")
