from flask import Flask, request, jsonify
from flask_cors import CORS
import joblib
import pandas as pd
import numpy as np
import os
import tempfile
import json
from PIL import Image
from scipy import ndimage
from datetime import datetime
from improved_voice_assistant import AgriVoiceAssistant
import recommendation_engine
import pest_engine
import market_engine
import base64

def encode_image(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

def verify_plant_with_groq(image_path):
    """
    Verify if the uploaded image contains a plant using Groq's Llama 4 Scout model.
    Returns: (is_plant: bool, message: str)
    """
    try:
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY") or os.getenv("VITE_GROQ_CHATBOT_API_KEY")
        if not api_key:
            print("Groq API Key missing for plant verification")
            return True, "Verification skipped (No API Key)"

        client = Groq(api_key=api_key)
        base64_image = encode_image(image_path)

        prompt = "Strictly analyze this image. Is it a plant, crop, fruit, vegetable, leaf, or soil? Answer 'YES' only if it is clearly related to agriculture or nature. If it is a man-made object, animal, human, or random object (like candy, toy, car), answer 'NO'. Answer with just 'YES' or 'NO'."

        completion = client.chat.completions.create(
            model="meta-llama/llama-4-scout-17b-16e-instruct",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.1,
            max_tokens=10
        )
        
        response = completion.choices[0].message.content.strip().upper()
        print(f"Plant Verification Response: {response}")
        
        if "YES" in response:
            return True, "Plant detected"
        else:
            return False, response

    except Exception as e:
        print(f"Plant verification error: {e}")
        return True, f"Verification skipped (Error: {str(e)})" # Fail open on error

app = Flask(__name__)
CORS(app)

# Initialize voice assistant
voice_assistant = AgriVoiceAssistant()
# Lazy loading for yield models (load only when needed)
yield_models_loaded = False
model = None
scalers = None
encoders = None
feature_columns = None

def load_yield_models():
    """Lazy load yield models only when first requested"""
    global yield_models_loaded, model, scalers, encoders, feature_columns
    print(f"load_yield_models called. Current state - yield_models_loaded: {yield_models_loaded}")
    if not yield_models_loaded:
        try:
            print("Attempting to load yield prediction models...")
            print("Loading model...")
            model = joblib.load('models/yield_prediction_model.pkl')
            print("Model loaded successfully")
            print("Loading scalers...")
            scalers = joblib.load('models/scalers.pkl')
            print("Scalers loaded successfully")
            print("Loading encoders...")
            encoders = joblib.load('models/encoders.pkl')
            print("Encoders loaded successfully")
            print("Loading feature columns...")
            feature_columns = joblib.load('models/feature_columns.pkl')
            print("Feature columns loaded successfully")
            yield_models_loaded = True
            print("Yield prediction models loaded successfully")
        except Exception as e:
            print(f"Yield prediction models not available: {e}")
            import traceback
            traceback.print_exc()
    print(f"load_yield_models returning: {yield_models_loaded}")
    return yield_models_loaded

def predict_disease_archive4(image_path, model_path="archive4_model_output/model.h5", labels_path="archive4_model_output/labels.json"):
    """Predict plant disease using Archive4 TensorFlow model"""
    try:
        import tensorflow as tf
        
        # Load model and labels
        model = tf.keras.models.load_model(model_path)
        with open(labels_path, 'r') as f:
            class_mapping = json.load(f)
        
        # Preprocess image
        img = Image.open(image_path)
        img = img.convert('RGB')
        img = img.resize((224, 224))
        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)
        
        # Predict
        predictions = model.predict(img_array, verbose=0)
        predicted_class_idx = np.argmax(predictions[0])
        confidence = predictions[0][predicted_class_idx]
        
        # Get class name
        predicted_class = class_mapping[str(predicted_class_idx)]
        
        return predicted_class, confidence
    except Exception as e:
        print(f"Archive4 model prediction error: {e}")
        return None, None

def predict_disease(image_path, model_path="sklearn_model_output/model.pkl", labels_path="sklearn_model_output/labels.json"):
    """
    Predict plant disease from image using enhanced feature extraction
    """
    try:
        IMG_SIZE = 128  # Must match training size
        
        # Open and resize image
        img = Image.open(image_path).convert('RGB')
        img = img.resize((IMG_SIZE, IMG_SIZE))

        # Convert to numpy array
        img_array = np.array(img)

        # Extract enhanced features (same as training)
        # 1. Color histogram features (more bins for better detail)
        hist_r, _ = np.histogram(img_array[:,:,0], bins=64, range=(0, 256))
        hist_g, _ = np.histogram(img_array[:,:,1], bins=64, range=(0, 256))
        hist_b, _ = np.histogram(img_array[:,:,2], bins=64, range=(0, 256))
        
        # Normalize histograms
        hist_r = hist_r / (IMG_SIZE * IMG_SIZE)
        hist_g = hist_g / (IMG_SIZE * IMG_SIZE)
        hist_b = hist_b / (IMG_SIZE * IMG_SIZE)
        
        # 2. Statistical features per channel
        mean_rgb = np.mean(img_array, axis=(0, 1))
        std_rgb = np.std(img_array, axis=(0, 1))
        median_rgb = np.median(img_array, axis=(0, 1))
        min_rgb = np.min(img_array, axis=(0, 1))
        max_rgb = np.max(img_array, axis=(0, 1))
        
        # 3. Color space conversions
        hsv_img = img.convert('HSV')
        hsv_array = np.array(hsv_img)
        mean_hsv = np.mean(hsv_array, axis=(0, 1))
        std_hsv = np.std(hsv_array, axis=(0, 1))
        
        # 4. Texture features
        gray = np.mean(img_array, axis=2).astype(np.float32)
        laplacian = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]])
        edges = ndimage.convolve(gray, laplacian)
        edge_mean = np.mean(np.abs(edges))
        edge_std = np.std(edges)
        
        # 5. Green channel analysis
        green_ratio = np.mean(img_array[:,:,1]) / (np.mean(img_array) + 1e-6)
        
        # 6. Disease color indicators
        brown_mask = (img_array[:,:,0] > 100) & (img_array[:,:,1] > 50) & (img_array[:,:,1] < 150) & (img_array[:,:,2] < 100)
        brown_ratio = np.sum(brown_mask) / (IMG_SIZE * IMG_SIZE)
        
        yellow_mask = (img_array[:,:,0] > 150) & (img_array[:,:,1] > 150) & (img_array[:,:,2] < 100)
        yellow_ratio = np.sum(yellow_mask) / (IMG_SIZE * IMG_SIZE)
        
        # 7. Spatial variance
        h, w = img_array.shape[:2]
        q1 = img_array[:h//2, :w//2]
        q2 = img_array[:h//2, w//2:]
        q3 = img_array[h//2:, :w//2]
        q4 = img_array[h//2:, w//2:]
        quad_means = np.array([np.mean(q1), np.mean(q2), np.mean(q3), np.mean(q4)])
        spatial_variance = np.std(quad_means)
        
        # 8. Combine all features
        features = np.concatenate([
            hist_r, hist_g, hist_b,
            mean_rgb, std_rgb, median_rgb, min_rgb, max_rgb,
            mean_hsv, std_hsv,
            [edge_mean, edge_std],
            [green_ratio, brown_ratio, yellow_ratio],
            [spatial_variance]
        ])
        features = features.reshape(1, -1)

        # Load model and labels
        model = joblib.load(model_path)

        with open(labels_path, 'r') as f:
            class_names = json.load(f)

        # Predict
        prediction = model.predict(features)[0]
        probabilities = model.predict_proba(features)[0]

        predicted_class = class_names[prediction]
        confidence = probabilities[prediction]

        return predicted_class, confidence
    except Exception as e:
        print(f"Error processing {image_path}: {e}")
        import traceback
        traceback.print_exc()
        return None, None

@app.route('/predict', methods=['POST'])
def predict_yield():
    print("Attempting to load yield models...")
    models_loaded = load_yield_models()
    print(f"Models loaded: {models_loaded}")
    if not models_loaded:
        print("Returning 503 error: Yield prediction models not available")
        return jsonify({'error': 'Yield prediction models not available'}), 503

    try:
        data = request.json

        # Create input dataframe
        # Use the same year normalization approach as in training
        # Based on the dataset range (2010 to 2023)
        year_min, year_max = 2010, 2023
        
        # Get historical average for better estimates
        hist_avg = get_historical_average(data['crop'], data['district'])
        
        input_data = pd.DataFrame([{
            'year_normalized': (data['year'] - year_min) / (year_max - year_min),
            'crop_encoded': encoders['crop'].transform([data['crop']])[0],
            'district_encoded': encoders['district'].transform([data['district']])[0],
            'season_encoded': encoders['season'].transform([data['season']])[0],
            'area_hectares': data['area_hectares'],
            'production_tonnes': data.get('production_tonnes', data['area_hectares'] * (hist_avg / 1000)),  # Convert kg to tonnes
            'area_log': np.log1p(data['area_hectares']),
            'production_log': np.log1p(data.get('production_tonnes', data['area_hectares'] * (hist_avg / 1000))),
            'yield_trend_3yr': data.get('yield_trend_3yr', hist_avg),
            'yield_trend_5yr': data.get('yield_trend_5yr', hist_avg)
        }])

        # Make prediction
        prediction = model.predict(input_data)[0]

        # Calculate confidence interval (±15%)
        lower = prediction * 0.85
        upper = prediction * 1.15

        return jsonify({
            'predicted_yield': float(prediction),
            'confidence_interval': {
                'lower': float(lower),
                'upper': float(upper)
            }
        })

    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/crops', methods=['GET'])
def get_crops():
    print("Attempting to load yield models for /crops...")
    models_loaded = load_yield_models()
    print(f"Models loaded for /crops: {models_loaded}")
    if not models_loaded:
        print("Returning 503 error for /crops: Yield prediction models not available")
        return jsonify({'error': 'Yield prediction models not available'}), 503
    return jsonify(encoders['crop'].classes_.tolist())

@app.route('/districts', methods=['GET'])
def get_districts():
    print("Attempting to load yield models for /districts...")
    models_loaded = load_yield_models()
    print(f"Models loaded for /districts: {models_loaded}")
    if not models_loaded:
        print("Returning 503 error for /districts: Yield prediction models not available")
        return jsonify({'error': 'Yield prediction models not available'}), 503
    return jsonify(encoders['district'].classes_.tolist())

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'API server is running'})

@app.route('/detect-disease', methods=['POST'])
def detect_disease():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400

        image_file = request.files['image']
        if image_file.filename == '':
            return jsonify({'error': 'No image selected'}), 400

        # Save uploaded image to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as temp_file:
            image_file.save(temp_file.name)
            temp_path = temp_file.name

        try:
            # 1. Verify if it is a plant using Groq Vision
            is_plant, verification_msg = verify_plant_with_groq(temp_path)
            if not is_plant:
                return jsonify({
                    'error': f"Cannot detect. This is not a plant. ({verification_msg})",
                    'is_plant': False
                }), 400

            # Try Archive4 model first (TensorFlow)
            if os.path.exists('archive4_model_output/model.h5'):
                predicted_class, confidence = predict_disease_archive4(temp_path)
                if predicted_class:
                    result = {
                        'disease': predicted_class,
                        'confidence': float(confidence),
                        'severity': 'high' if confidence > 0.8 else 'medium' if confidence > 0.6 else 'low',
                        'treatment': get_treatment_recommendation(predicted_class),
                        'affectedPart': get_affected_part(predicted_class),
                        'symptoms': get_symptoms(predicted_class),
                        'preventiveMeasures': get_preventive_measures(predicted_class),
                        'economicImpact': get_economic_impact(predicted_class),
                        'model': 'archive4_tensorflow'
                    }
                    return jsonify(result)
            
            # Fallback to sklearn model
            predicted_class, confidence = predict_disease(
                temp_path,
                model_path='sklearn_model_output/model.pkl',
                labels_path='sklearn_model_output/labels.json'
            )

            if predicted_class is None:
                return jsonify({'error': 'Failed to process image'}), 500

            # Map predictions to the expected format for frontend
            result = {
                'disease': predicted_class,
                'confidence': float(confidence),
                'severity': 'high' if confidence > 0.8 else 'medium' if confidence > 0.6 else 'low',
                'treatment': get_treatment_recommendation(predicted_class),
                'affectedPart': get_affected_part(predicted_class),
                'symptoms': get_symptoms(predicted_class),
                'preventiveMeasures': get_preventive_measures(predicted_class),
                'economicImpact': get_economic_impact(predicted_class),
                'model': 'sklearn'
            }

            return jsonify(result)

        finally:
            # Clean up temporary file
            try:
                os.unlink(temp_path)
            except Exception as e:
                print(f"ERROR: Could not delete temporary file {temp_path}: {e}", flush=True)

    except Exception as e:
        return jsonify({'error': str(e)}), 500

def get_treatment_recommendation(disease):
    treatments = {
        'healthy': 'No treatment needed - plant is healthy',
        'leaf_blight': 'Apply copper-based fungicide every 7-10 days, improve air circulation',
        'leaf_rust': 'Apply systemic fungicide, remove infected leaves',
        'leaf_spot': 'Apply fungicide spray, ensure proper plant spacing',
        'nutrient_deficiency': 'Apply appropriate fertilizer based on soil test',
        'pest_infected': 'Use integrated pest management - beneficial insects and organic sprays',
        'stem_rot': 'Remove infected plants, apply fungicide to healthy plants',
        'rot': 'Remove infected parts, improve drainage, apply fungicide',
        'viral_disease': 'Remove infected plants, control insect vectors, use resistant varieties',
        'powdery_mildew': 'Apply sulfur-based fungicide, improve air circulation',
        'scab': 'Apply fungicide spray, remove fallen leaves, prune for air circulation',
        'anthracnose': 'Apply copper fungicide, remove infected debris, avoid overhead watering',
        'downy_mildew': 'Apply systemic fungicide, reduce humidity, improve drainage'
    }
    return treatments.get(disease, 'Consult agricultural expert')

def get_affected_part(disease):
    parts = {
        'healthy': 'none',
        'leaf_blight': 'leaf',
        'leaf_rust': 'leaf',
        'leaf_spot': 'leaf',
        'nutrient_deficiency': 'whole_plant',
        'pest_infected': 'multiple',
        'stem_rot': 'stem',
        'rot': 'fruit_stem',
        'viral_disease': 'whole_plant',
        'powdery_mildew': 'leaf',
        'scab': 'fruit_leaf',
        'anthracnose': 'fruit_leaf',
        'downy_mildew': 'leaf'
    }
    return parts.get(disease, 'unknown')

def get_symptoms(disease):
    symptoms = {
        'healthy': ['No visible symptoms'],
        'leaf_blight': ['Brown spots with yellow halos', 'Wilting leaves', 'Premature leaf drop'],
        'leaf_rust': ['Orange-red pustules on leaf undersides', 'Yellow spots on upper surface'],
        'leaf_spot': ['Circular spots on leaves', 'Spots may have dark borders'],
        'nutrient_deficiency': ['Yellowing of older leaves', 'Stunted growth', 'Poor fruit development'],
        'pest_infected': ['Holes in leaves', 'Sticky residue', 'Distorted growth'],
        'stem_rot': ['Dark, water-soaked lesions on stem', 'Soft, mushy tissue'],
        'rot': ['Soft, decaying tissue', 'Foul odor', 'Discoloration'],
        'viral_disease': ['Mosaic patterns on leaves', 'Stunted growth', 'Leaf curling', 'Yellow streaks'],
        'powdery_mildew': ['White powdery coating on leaves', 'Distorted leaves', 'Reduced growth'],
        'scab': ['Dark, rough lesions on fruit', 'Corky spots on leaves'],
        'anthracnose': ['Dark sunken lesions', 'Fruit rot', 'Leaf spots with dark margins'],
        'downy_mildew': ['Yellow patches on upper leaf surface', 'Gray fuzzy growth on undersides']
    }
    return symptoms.get(disease, ['Symptoms not specified'])

def get_preventive_measures(disease):
    measures = {
        'healthy': ['Continue good agricultural practices'],
        'leaf_blight': ['Avoid overhead watering', 'Remove infected debris', 'Plant resistant varieties'],
        'leaf_rust': ['Ensure good air circulation', 'Avoid high humidity', 'Use resistant cultivars'],
        'leaf_spot': ['Avoid overhead watering', 'Ensure proper plant spacing', 'Remove infected leaves'],
        'nutrient_deficiency': ['Regular soil testing', 'Balanced fertilization', 'Proper irrigation'],
        'pest_infected': ['Crop rotation', 'Beneficial insects', 'Regular monitoring'],
        'stem_rot': ['Improve drainage', 'Avoid overwatering', 'Use pathogen-free seeds'],
        'rot': ['Proper storage conditions', 'Avoid mechanical damage', 'Good sanitation'],
        'viral_disease': ['Control insect vectors', 'Use virus-free planting material', 'Remove infected plants'],
        'powdery_mildew': ['Reduce humidity', 'Improve air circulation', 'Avoid dense planting'],
        'scab': ['Remove fallen leaves', 'Prune for air flow', 'Apply preventive fungicides'],
        'anthracnose': ['Crop rotation', 'Remove plant debris', 'Avoid overhead irrigation'],
        'downy_mildew': ['Improve drainage', 'Reduce leaf wetness', 'Use resistant varieties']
    }
    return measures.get(disease, ['Follow good agricultural practices'])

def get_economic_impact(disease):
    impacts = {
        'healthy': 'No economic impact',
        'leaf_blight': 'Can reduce yield by 20-40% if untreated',
        'leaf_rust': 'Yield loss of 15-30% in severe cases',
        'leaf_spot': 'Yield reduction of 10-25% depending on severity',
        'nutrient_deficiency': 'Reduced yield and quality, increased input costs',
        'pest_infected': 'Yield loss varies by pest type and infestation level',
        'stem_rot': 'Complete plant loss in severe infections',
        'rot': 'Post-harvest losses of 30-50%, reduced market value',
        'viral_disease': 'Severe yield loss 40-100%, no cure available',
        'powdery_mildew': 'Yield reduction of 10-30%, quality degradation',
        'scab': 'Reduced fruit quality and marketability, 20-40% loss',
        'anthracnose': 'Significant fruit losses 30-60%, quality issues',
        'downy_mildew': 'Yield loss of 20-50% in favorable conditions'
    }
    return impacts.get(disease, 'Economic impact varies')

@app.route('/voice-query', methods=['POST'])
def handle_voice_query():
    """Handle voice assistant queries"""
    try:
        data = request.json
        query_text = data.get('text', '')
        
        if not query_text:
            return jsonify({'error': 'No query text provided'}), 400
        
        # Process query with voice assistant
        response = voice_assistant.process_voice_input(query_text)
        
        return jsonify({
            'success': True,
            'response': response,
            'timestamp': str(datetime.now())
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/voice-examples', methods=['GET'])
def get_voice_examples():
    """Get example voice queries"""
    examples = {
        'hindi': [
            "गेहूं में रोग आ गया है, क्या करें?",
            "आज पानी देना चाहिए?", 
            "फसल कब काटनी चाहिए?",
            "खाद कितनी डालनी चाहिए?"
        ],
        'english': [
            "Wheat has disease, what to do?",
            "Should I water today?",
            "When should I harvest?",
            "How much fertilizer to apply?"
        ]
    }
    return jsonify(examples)

@app.route('/recommend-fertilizer', methods=['POST'])
def recommend_fertilizer():
    """
    Get fertilizer and irrigation recommendations based on crop and environmental data using Groq (Llama 3).
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No input data provided'}), 400
            
        print(f"Recommendation Request: {data}")

        # Initialize Groq client
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY") or os.getenv("VITE_GROQ_CHATBOT_API_KEY")
        if not api_key:
             return jsonify({'error': 'GROQ_API_KEY not found'}), 500
             
        client = Groq(api_key=api_key)

        # Construct Prompt
        prompt = f"""
        You are an expert agricultural scientist following ICAR (Indian Council of Agricultural Research) and FAO standards.
        Analyze the following field data and provide a precise fertilizer and irrigation plan.

        Field Data:
        - Crop: {data.get('crop')}
        - Soil N-P-K: {data.get('soil_n')}-{data.get('soil_p')}-{data.get('soil_k')}
        - Soil pH: {data.get('soil_ph')}
        - Soil Moisture: {data.get('soil_moisture')}%
        - Rainfall Forecast: {data.get('rainfall')} mm
        - Growth Stage: {data.get('stage')}
        - Soil Type: {data.get('soil_type')}

        Task:
        1. Calculate N-P-K recommendation in kg/ha based on crop needs and soil status.
        2. Provide irrigation advice based on moisture and rainfall.
        3. Suggest pH corrections if needed.
        4. List 2-3 specific agronomic adjustments (e.g., split application).

        Return ONLY valid JSON in this exact structure:
        {{
            "source": "AgriSphere AI (ICAR/FAO Standards)",
            "fertilizer": {{
                "nitrogen": "XX kg/ha",
                "phosphorus": "XX kg/ha",
                "potassium": "XX kg/ha",
                "adjustments": ["Tip 1", "Tip 2"]
            }},
            "soil_health": {{
                "ph_status": {data.get('soil_ph')},
                "ph_recommendation": "Advice for pH correction or maintenance",
                "recommendation": "General soil health tip"
            }},
            "irrigation": {{
                "status": "Irrigate Immediately" OR "No Irrigation Needed",
                "water_amount": "XX mm",
                "schedule": {{
                    "next_3_days": "Rain Expected" OR "Clear"
                }}
            }}
        }}
        """

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a helpful agricultural AI. Output valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=600,
            response_format={"type": "json_object"}
        )

        response_content = completion.choices[0].message.content
        recommendation = json.loads(response_content)
        
        return jsonify(recommendation)
        
    except Exception as e:
        print(f"Groq Recommendation Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/predict-pest', methods=['POST'])
def predict_pest():
    """
    Get pest risk prediction based on weather data using Groq (Llama 3).
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No input data provided'}), 400
            
        print(f"Pest Prediction Request: {data}")

        # Initialize Groq client
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY") or os.getenv("VITE_GROQ_CHATBOT_API_KEY")
        if not api_key:
             return jsonify({'error': 'GROQ_API_KEY not found'}), 500
             
        client = Groq(api_key=api_key)
        
        # Get next 7 days for forecast labels
        from datetime import datetime, timedelta
        days = [(datetime.now() + timedelta(days=i)).strftime("%a") for i in range(7)]
        days_str = ", ".join(days)

        prompt = f"""
        You are an expert agricultural entomologist following strictly ICAR (Indian Council of Agricultural Research) and FAO protocols.
        Analyze the following environmental conditions and predict the pest attack risk for the specified crop.

        Conditions:
        - Crop: {data.get('crop')}
        - Temperature: {data.get('temp')}°C
        - Humidity: {data.get('humidity')}%
        - Rainfall: {data.get('rainfall')} mm

        Task:
        1. Identify the most likely pest threat for this crop under these conditions according to Indian agricultural region standards.
        2. Estimate the risk probability (0-100%).
        3. Determine risk level (Low/Medium/High).
        4. Provide a specific preventive or curative recommendation (ICAR approved).
        5. Forecast risk trend for the next 7 days ({days_str}) based on simple weather assumptions (e.g., if high humidity persists).

        Return ONLY valid JSON in this exact structure:
        {{
            "primary_pest": {{
                "pest_name": "Name of Pest",
                "risk_score": 85,
                "risk_level": "High",
                "recommendation": "Specific advice"
            }},
            "forecast_7_days": [
                {{ "day": "{days[0]}", "risk_score": 80 }},
                {{ "day": "{days[1]}", "risk_score": 82 }},
                {{ "day": "{days[2]}", "risk_score": 75 }},
                {{ "day": "{days[3]}", "risk_score": 70 }},
                {{ "day": "{days[4]}", "risk_score": 65 }},
                {{ "day": "{days[5]}", "risk_score": 60 }},
                {{ "day": "{days[6]}", "risk_score": 55 }}
            ]
        }}
        """

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a helpful agricultural AI. Output valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2,
            max_tokens=600,
            response_format={"type": "json_object"}
        )

        response_content = completion.choices[0].message.content
        result = json.loads(response_content)
        
        return jsonify(result)
        
    except Exception as e:
        print(f"Groq Pest Prediction Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/market-advisory', methods=['POST'])
def market_advisory():
    """
    Get seed-to-market advisory (harvest timing + price forecast).
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No input data provided'}), 400
            
        print(f"Market Advisory Request: {data}")
        result = market_engine.analyze_market(data)
        return jsonify(result)
        
    except Exception as e:
        print(f"Market Advisory Error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/marketplace/listings', methods=['GET'])
def get_marketplace_listings():
    """Get all produce listings from other farmers"""
    try:
        if os.path.exists('marketplace.json'):
            with open('marketplace.json', 'r') as f:
                listings = json.load(f)
            return jsonify(listings)
        return jsonify([])
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/marketplace/list', methods=['POST'])
def add_marketplace_listing():
    """Farmer lists their produce for buyers"""
    try:
        new_listing = request.json
        if not new_listing:
            return jsonify({'error': 'No data provided'}), 400
            
        listings = []
        if os.path.exists('marketplace.json'):
            with open('marketplace.json', 'r') as f:
                listings = json.load(f)
        
        # Add ID and Date
        new_listing['id'] = len(listings) + 1
        new_listing['date'] = datetime.now().strftime("%Y-%m-%d")
        
        listings.insert(0, new_listing) # Show newest first
        
        with open('marketplace.json', 'w') as f:
            json.dump(listings, f, indent=2)
            
        return jsonify({'success': True, 'listing': new_listing})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/generate-digital-twin', methods=['POST'])
def generate_digital_twin():
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No data provided'}), 400

        print(f"Generating Digital Twin for: {data}")
        
        # Call Groq to generate realistic farm data
        success, result = generate_digital_twin_with_groq(data)
        
        if success:
            return jsonify(result)
        else:
            return jsonify({'error': result}), 500

    except Exception as e:
        print(f"Error in digital twin generation: {e}")
        return jsonify({'error': str(e)}), 500

def generate_digital_twin_with_groq(farm_data):
    """
    Generate realistic digital twin data using Groq based on location (Lat/Lng OR Text) and size.
    """
    try:
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY") or os.getenv("VITE_GROQ_CHATBOT_API_KEY")
        if not api_key:
            return False, "Groq API Key missing"

        client = Groq(api_key=api_key)
        
        # Calculate hectares from acres (approx)
        acres = float(farm_data.get('size', 10))
        hectares = round(acres * 0.404686, 2)
        
        # Construct Location Context
        lat = farm_data.get('latitude')
        lng = farm_data.get('longitude')
        location_text = ""
        
        if farm_data.get('town') and farm_data.get('district'):
            location_text = f"{farm_data.get('town')}, {farm_data.get('district')}, {farm_data.get('state')}"
        
        prompt = f"""
        Generate a realistic 'Digital Twin' dataset for a farm.
        
        INPUTS:
        - Name: {farm_data.get('farmName')}
        - Owner: {farm_data.get('ownerName')}
        - Size: {acres} Acres ({hectares} Hectares)
        - Location Coordinates: Lat {lat}, Lng {lng}
        - Location Name: {location_text}
        
        Task:
        1. **Location Resolution**: 
           - If 'Location Name' is provided but Coordinates are missing/zero, ESTIMATE the Lat/Lng for that town/village.
           - If Coordinates are provided, use them to identify the micro-region.
           
        2. **Agricultural Profiling (DIVERSITY IS CRITICAL)**:
           - Create a UNIQUE profile specific to this exact location.
           - **CRITICAL**: Generate AT LEAST 3-4 *DISTINCT* items for Pests and Crops. Do NOT repeat the same pest/crop 4 times.
           - Example: If Pest 1 is "Stem Borer", Pest 2 MUST be different (e.g., "Leaf Folder").
           - Example: Include variety in Crop Stages (e.g., one field "vegetative", another "flowering").

        OUTPUT JSON format ONLY. Structure:
        {{
            "location": {{ "lat": 22.123, "lng": 88.123 }}, 
            "farmBoundary": {{ "area": {hectares} }},
            "visual_summary": "Located in [Town], [District]. The soil is [Type], suitable for [Crops].",
            "soilZones": [
                {{ "id": "zone-1", "soilType": "loamy", "ph": 6.5, "nutrients": {{ "nitrogen": 40, "phosphorus": 30, "potassium": 20 }}, "organicMatter": 3.5, "fertility": "high", "recommendations": ["specific advice"] }},
                {{ "id": "zone-2", "soilType": "sandy loam", "ph": 7.0, "nutrients": {{ "nitrogen": 35, "phosphorus": 25, "potassium": 15 }}, "organicMatter": 3.0, "fertility": "medium", "recommendations": ["different advice"] }}
            ],
            "irrigationZones": [
                {{ "id": "irrig-1", "type": "drip", "efficiency": 92, "status": "active" }}
            ],
            "pestProneAreas": [
                 {{ "id": "pest-1", "pestType": "Specific Pest A", "riskLevel": "high", "preventiveMeasures": ["measure A"] }},
                 {{ "id": "pest-2", "pestType": "Specific Pest B", "riskLevel": "medium", "preventiveMeasures": ["measure B"] }},
                 {{ "id": "pest-3", "pestType": "Specific Pest C", "riskLevel": "low", "preventiveMeasures": ["measure C"] }}
            ],
            "cropGrowthStages": [
                 {{ "id": "crop-1", "cropType": "Crop A", "stage": "vegetative", "health": 85, "plantingDate": "2024-11-01" }},
                 {{ "id": "crop-2", "cropType": "Crop B", "stage": "flowering", "health": 90, "plantingDate": "2024-10-15" }},
                 {{ "id": "crop-3", "cropType": "Crop C", "stage": "harvesting", "health": 80, "plantingDate": "2024-09-01" }}
            ],
            "weatherData": {{ "temperature": 28, "humidity": 60, "rainfall": 12, "windSpeed": 5 }}
        }}
        """

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are an agricultural data scientist. Provide specific, variable, and diverse data. Never repeat the same item in a list."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.8,
            max_tokens=2500,
            response_format={"type": "json_object"}
        )
        
        response_content = completion.choices[0].message.content
        result = json.loads(response_content)
        return True, result

    except Exception as e:
        print(f"Groq generation error: {e}")
        return False, str(e)

@app.route('/analyze-health', methods=['POST'])
def analyze_health():
    """
    Analyze overall plant health using Groq based on detected issues.
    """
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No input data provided'}), 400

        print(f"Health Analysis Request: {data}")

        # Initialize Groq client
        from groq import Groq
        api_key = os.getenv("GROQ_API_KEY") or os.getenv("VITE_GROQ_CHATBOT_API_KEY")
        if not api_key:
             return jsonify({'error': 'GROQ_API_KEY not found'}), 500
             
        client = Groq(api_key=api_key)

        prompt = f"""
        You are an expert agricultural scientist. Analyze the following plant health findings and provide a summary assessment.
        
        Findings:
        - Diseases: {json.dumps(data.get('diseases', []), indent=2)}
        - Pests: {json.dumps(data.get('pests', []), indent=2)}
        - Nutrient Deficiencies: {json.dumps(data.get('nutrients', []), indent=2)}
        - Soil Analysis: {json.dumps(data.get('soil', {}), indent=2)}
        
        Task:
        1. Determine an overall Health Score (0-100). 100 is perfect health, 0 is dead. Be realistic based on severity.
        2. Assign a Health Status (one of: 'excellent', 'good', 'fair', 'poor', 'critical').
        3. Provide 3 specific, high-priority, actionable recommendations for the farmer. Focus on the most critical issues first.
           - Recommendations should be concise instructions (e.g., "Apply copper fungicide immediately").
           
        Return ONLY valid JSON in this exact structure:
        {{
            "score": 75,
            "status": "fair",
            "recommendations": [
                "Recommendation 1",
                "Recommendation 2",
                "Recommendation 3"
            ]
        }}
        """

        completion = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a helpful agricultural AI. Output valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=300,
            response_format={"type": "json_object"}
        )

        response_content = completion.choices[0].message.content
        result = json.loads(response_content)
        
        return jsonify(result)

    except Exception as e:
        print(f"Health Analysis Error: {e}")
        return jsonify({'error': str(e)}), 500
if __name__ == '__main__':
    print("\n" + "="*50)
    print("AgriSphere AI API Server Starting...")
    print("="*50)
    print("Server will be available at: http://localhost:5000")
    print("Health check: http://localhost:5000/health")
    print("Disease detection: POST to /detect-disease")
    print("Yield prediction: POST to /predict")
    print("Voice assistant: POST to /voice-query")
    print("Fertilizer Recommendation: POST to /recommend-fertilizer")
    print("Pest Prediction: POST to /predict-pest")
    print("Market Advisory: POST to /market-advisory")
    print("Voice examples: GET /voice-examples")
    print("="*50 + "\n")
    app.run(debug=True, port=5000, threaded=True)
