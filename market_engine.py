import datetime
import random

"""
Seed-to-Market Advisory Engine
Logic: 
1. Harvest Window = Sowing Date + Maturity Days
2. Price Forecasting = Base Price + Trend + Volatility Simulation
"""

# Crop Knowledge Base
# Maturity in days (min, max)
# Base Price in ₹/Quintal
# Volatility: Low (stable), Medium (seasonal), High (perishable)
CROP_MARKET_DATA = {
    'rice': {'maturity': (120, 150), 'price': 2200, 'volatility': 0.05},
    'wheat': {'maturity': (110, 140), 'price': 2125, 'volatility': 0.04},
    'cotton': {'maturity': (150, 180), 'price': 6000, 'volatility': 0.08},
    'maize': {'maturity': (90, 110), 'price': 2090, 'volatility': 0.06},
    'tomato': {'maturity': (60, 80), 'price': 1500, 'volatility': 0.25}, # High volatility
    'potato': {'maturity': (90, 120), 'price': 1200, 'volatility': 0.15},
    'sugarcane': {'maturity': (300, 365), 'price': 3150, 'volatility': 0.02}
}

def analyze_market(data):
    """
    Input: { "crop": "Rice", "sowing_date": "YYYY-MM-DD", "acres": 5 }
    """
    crop = data.get('crop', 'rice').lower()
    sowing_date_str = data.get('sowing_date', datetime.date.today().strftime("%Y-%m-%d"))
    try:
        acres = float(data.get('acres', 1))
    except (ValueError, TypeError):
        acres = 1.0

    try:
        sowing_date = datetime.datetime.strptime(sowing_date_str, "%Y-%m-%d").date()
    except ValueError:
        sowing_date = datetime.date.today()

    crop_info = CROP_MARKET_DATA.get(crop, CROP_MARKET_DATA['rice'])
    
    # 1. Calculate Harvest Window
    min_days, max_days = crop_info['maturity']
    harvest_start = sowing_date + datetime.timedelta(days=min_days)
    harvest_end = sowing_date + datetime.timedelta(days=max_days)
    
    today = datetime.date.today()
    days_to_harvest = (harvest_start - today).days
    
    if days_to_harvest < 0:
        status = "Harvest Overdue"
        days_to_harvest = 0
    elif days_to_harvest == 0:
        status = "Harvest Today"
    else:
        status = f"Harvest in ~{days_to_harvest} days"

    # 2. Price Simulation (MVP)
    # Simulate a realistic trend based on volatility
    base_price = crop_info['price']
    volatility = crop_info['volatility']
    
    # Random realistic fluctuation for "Current Market Price"
    current_fluctuation = random.uniform(-volatility, volatility)
    current_price = int(base_price * (1 + current_fluctuation))
    
    # Forecast for next 4 weeks
    forecast = []
    trend_factor = random.choice([-0.02, 0.01, 0.03, 0.05]) # Random market trend (bear/bull)
    
    temp_price = current_price
    
    for i in range(1, 5):
        # Weekly fluctuation
        weekly_change = random.uniform(-volatility/2, volatility/2) + trend_factor
        temp_price = temp_price * (1 + weekly_change)
        
        forecast.append({
            "week": f"Week {i}",
            "price": int(temp_price),
            "change": f"{weekly_change*100:.1f}%"
        })
        
    # Recommendation
    if forecast[-1]['price'] > current_price * 1.05:
        advice = "Market is rising. Consider storing if possible."
        trend = "Bullish (Rising)"
    elif forecast[-1]['price'] < current_price * 0.95:
        advice = "Prices dropping. Sell immediately after harvest."
        trend = "Bearish (Falling)"
    else:
        advice = "Market stable. Sell at convenience."
        trend = "Stable"

    # Estimated Revenue
    # Avg yield per acre (approx placeholders)
    yield_map = {
        'rice': 25, 'wheat': 20, 'cotton': 10, 'maize': 30, 
        'tomato': 150, 'potato': 100, 'sugarcane': 400
    }
    est_yield = yield_map.get(crop, 20) * acres # Quintals
    est_revenue = int(est_yield * current_price)

    return {
        "crop": crop.title(),
        "sowing_date": sowing_date.strftime("%Y-%m-%d"),
        "harvest_date_start": harvest_start.strftime("%b %d, %Y"),
        "harvest_date_end": harvest_end.strftime("%b %d, %Y"),
        "days_to_harvest": days_to_harvest,
        "status": status,
        "current_price": current_price,
        "forecast": forecast,
        "market_trend": trend,
        "advisory": advice,
        "estimated_yield": f"{est_yield} Quintals",
        "estimated_revenue": f"₹{est_revenue:,}"
    }

if __name__ == "__main__":
    test_data = {'crop': 'tomato', 'sowing_date': '2025-10-01', 'acres': 2}
    print(analyze_market(test_data))
