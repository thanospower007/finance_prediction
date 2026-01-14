import requests
import json

try:
    url = "http://127.0.0.1:5000/api/analyze/AAPL?compare=XIACY&date=2022-12-02&epochs=10"
    print(f"Requesting: {url}")
    r = requests.get(url)
    if r.status_code == 200:
        data = r.json()
        
        comp = data.get('comparison')
        if not comp:
            print("No comparison data returned.")
        else:
            print(f"Comparison Ticker: {comp.get('ticker')}")
        print(f"Is Backtest: {data['main'].get('is_backtest')}")
        print(f"Actual Outcomes: {data['main'].get('actual_outcomes')}")
        print(f"Recommendation: {data['main'].get('recommendation')}")
        print(f"Analysis Date: {data['main']['analysis_date']}")
            
    else:
        print(f"Error: {r.status_code}")
        print(r.text)

except Exception as e:
    print(f"Failed: {e}")
