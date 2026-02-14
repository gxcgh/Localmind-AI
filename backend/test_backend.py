import requests
import sys

# Allow overriding URL via command line arg
BASE_URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000"

def test_health():
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Health Check Passed")
        else:
            print(f"❌ Health Check Failed: {response.text}")
    except Exception as e:
        print(f"❌ Health Check Failed: {e}")

def test_analyze_text():
    try:
        payload = {
            "text": "What is the capital of India?",
            "location": "New Delhi",
            "language_code": "en"
        }
        # Note: This will fail if GEMINI_API_KEY is not set in backend
        response = requests.post(f"{BASE_URL}/analyze", data=payload)
        
        if response.status_code == 200:
            print("✅ Analyze Text Passed")
            print("Response:", response.json())
        elif response.status_code == 500 and "API Key missing" in response.text:
             print("⚠️  Analyze Text Skipped (API Key missing)")
        else:
            print(f"❌ Analyze Text Failed: {response.status_code} - {response.text}")
    except Exception as e:
        print(f"❌ Analyze Text Failed: {e}")

if __name__ == "__main__":
    print(f"Testing Backend at {BASE_URL}...")
    test_health()
    test_analyze_text()