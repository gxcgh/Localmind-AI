import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    # Try to read only the key if dotenv fails or file is tricky
    try:
        with open('.env') as f:
            for line in f:
                if line.startswith('GEMINI_API_KEY'):
                    api_key = line.split('=')[1].strip()
                    break
    except:
        pass

if not api_key:
    print("❌ GEMINI_API_KEY not found in .env")
    exit(1)

genai.configure(api_key=api_key)

print("Listing available models...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")
