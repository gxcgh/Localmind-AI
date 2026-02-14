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
# Using gemini-2.0-flash
# Note: Google Search Grounding removed due to stability issues with JSON mode.
genai.configure(api_key=API_KEY)
model = genai.GenerativeModel('gemini-2.0-flash')

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
    language_code: str = Form("en"), # e.g., 'hi', 'en', 'te'
    history: Optional[str] = Form(None) # JSON string of previous conversation
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
        
        # Parse History
        conversation_context = ""
        if history:
            try:
                # Expecting history as a list of {"role": "user"/"model", "content": "..."}
                history_list = json.loads(history)
                conversation_context = "PREVIOUS CONVERSATION HISTORY:\n"
                for msg in history_list:
                    role = msg.get("role", "unknown")
                    content = msg.get("content", "")
                    conversation_context += f"- {role.upper()}: {content}\n"
            except Exception as e:
                logger.warning(f"Failed to parse history: {e}")

        # 1. System Prompt / Context Construction
        base_prompt = """
        You are LocalMind AI, a hyperlocal assistant for India.
        Your goal is to provide real-time, actionable intelligence based on the user's location, visual input, and conversation history.
        
        CONTEXT:
        - Location: {location}
        - User's Language Preference: {language_code}
        
        {conversation_context}
        
        INSTRUCTIONS:
        1. Analyze the input (image, audio, text) combined with the Conversation History.
        2. Identify specific local details (shops, signs, food, transport, safety).
        3. If the user asks for a price, give a realistic estimate based on general knowledge.
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
        
        USER INPUT:
        {user_text}
        """
        
        formatted_prompt = base_prompt.format(
            location=location or "Unknown India Location",
            language_code=language_code,
            conversation_context=conversation_context,
            user_text=text or "Analyze my input."
        )
        
        inputs.append(formatted_prompt)

        # 2. Process Image
        if image:
            content = await image.read()
            try:
                img = Image.open(io.BytesIO(content))
                inputs.append(img)
            except Exception as e:
                logger.error(f"Image processing failed: {e}")
                raise HTTPException(status_code=400, detail="Invalid image file.")
        
        # 3. Process Audio
        if audio:
            audio_content = await audio.read()
            # Gemini supports audio via inline data mainly for small clips or File API for larger.
            # For 1.5/2.0 Flash, we can send raw data if mime type is supported (mp3, wav, aac, etc).
            # Expo Audio Recording is usually m4a (audio/mp4) or caf. Gemini accepts these.
            inputs.append({
                "mime_type": audio.content_type or "audio/mp4",
                "data": audio_content
            })

        # 4. Call Gemini
        logger.info(f"Sending request to Gemini... Location: {location}, Audio: {bool(audio)}")
        
        # Use strict JSON mode (supported when tools are NOT used)
        response = model.generate_content(
            inputs,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json"
            )
        )
        
        try:
            response_json = json.loads(response.text)
        except json.JSONDecodeError:
            logger.error(f"JSON Parse Error: {response.text}")
            response_json = {
                "response": "Error processing response.", 
                "show_map": False, 
                "locations": []
            }
        
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
