<<<<<<< HEAD
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GOOGLE_GEMINI_VISION_API_KEY") or os.getenv("GEMINI_API_KEY")
if not api_key:
    # Fallback to the key provided by user in prompt if .env fails
    api_key = "AIzaSyAv2YCKvg3n4fRxH6xD7Cqi3m5Vy0kx__I"

print(f"Using API Key: {api_key[:10]}...")
genai.configure(api_key=api_key)

print("Listing available models...")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(m.name)
except Exception as e:
    print(f"Error listing models: {e}")
=======
import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GROQ_API_KEY") or os.getenv("VITE_GROQ_CHATBOT_API_KEY")

if not api_key:
    print("No API key found")
    exit(1)

client = Groq(api_key=api_key)

try:
    models = client.models.list()
    with open("models.txt", "w") as f:
        for model in models.data:
            f.write(model.id + "\n")
            print(model.id)
except Exception as e:
    print(f"Error: {e}")
>>>>>>> 44612f63f18f414989e95cad041efb4d88c4764e
