import os
import json
import logging
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import google.generativeai as genai
from dotenv import load_dotenv
from PIL import Image
import io

# Load environment variables
load_dotenv()

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure Gemini
API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    logger.warning("GEMINI_API_KEY not found in environment variables.")

# Initialize Gemini Model
# Initialize Gemini Model with Google Search Grounding
# Using gemini-2.0-flash as it is stable and supports grounding (gemini-3-flash-preview might be experimental)
# Note: Google Search Grounding tool requires specific models.
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash', tools='google_search_retrieval')

app = FastAPI(title="LocalMind AI Backend")

# CORS - Allow all for MVP/Hackathon
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "LocalMind AI"}

@app.post("/analyze")
async def analyze(
    text: Optional[str] = Form(None),
    image: Optional[UploadFile] = File(None),
    audio: Optional[UploadFile] = File(None),
    location: Optional[str] = Form(None), # Expected format: "lat,long" or "City, Area"
    language_code: str = Form("en") # e.g., 'hi', 'en', 'te'
):
    """
    Multimodal analysis endpoint.
    Accepts Text (optional), Image (optional), Audio (optional), Location (required for best results).
    """
    try:
        if not API_KEY:
             raise HTTPException(status_code=500, detail="Server misconfiguration: API Key missing.")
        
        if not text and not image and not audio:
            raise HTTPException(status_code=400, detail="Either text, image, or audio must be provided.")

        inputs = []
        
        # 1. System Prompt / Context Construction
        base_prompt = """
        You are LocalMind AI, a hyperlocal assistant for India.
        Your goal is to provide real-time, actionable intelligence based on the user's location and input.
        
        CONTEXT:
        - Location: {location}
        - User's Language Preference: {language_code}
        
        INSTRUCTIONS:
        1. Analyze the input (image, audio, text).
        2. Identify specific local details (shops, signs, food, transport, safety).
        3. If the user asks for a price, give a realistic estimate.
        4. **CRITICAL**: Return your response in strict JSON format.
        
        JSON SCHEMA:
        {{
            "response": "Your natural language answer here (in the requested language). keep it concise.",
            "show_map": true/false, // Set to true ONLY if the user explicitly asks to see locations on a map (e.g., "show on map", "where is it", "plot locations").
            "locations": [
                {{
                    "name": "Name of the place",
                    "latitude": 12.34,
                    "longitude": 56.78,
                    "address": "Brief address"
                }}
            ]
        }}
        
        Use Google Search to find real coordinates if needed.
        
        USER INPUT:
        {user_text}
        """
        
        formatted_prompt = base_prompt.format(
            location=location or "Unknown India Location",
            language_code=language_code,
            user_text=text or "Analyze my input."
        )
        
        inputs.append(formatted_prompt)



        # 4. Call Gemini
        logger.info(f"Sending request to Gemini... Location: {location}, Audio: {bool(audio)}")
        # Request JSON response format
        response = model.generate_content(
            inputs,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        try:
            response_json = json.loads(response.text)
        except json.JSONDecodeError:
            # Fallback if model fails to output JSON (rare with response_mime_type)
            response_json = {"response": response.text, "show_map": False, "locations": []}
        
        # 5. Return formatted response
        return JSONResponse(content={
            "response": response_json.get("response", ""),
            "show_map": response_json.get("show_map", False),
            "locations": response_json.get("locations", []),
            "location_context": location
        })

    except Exception as e:
        logger.error(f"Error in analyze: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
