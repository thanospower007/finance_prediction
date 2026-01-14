import yfinance as yf
import pandas as pd

ticker = "XIACY"
print(f"Fetching {ticker}...")
df = yf.download(ticker, period="max")
print(f"Shape: {df.shape}")
if not df.empty:
    print(f"Index Type: {type(df.index)}")
    print(f"First Date: {df.index[0]}")
    print(f"Last Date: {df.index[-1]}")
    
    target = pd.Timestamp("2022-12-02")
    if df.index.tz is not None:
        print("Index has TZ. Strip.")
        df.index = df.index.tz_localize(None)
    
    mask = df.index <= target
    sub = df[mask]
    print(f"Rows <= 2022-12-02: {len(sub)}")
    if not sub.empty:
        print(f"Last Backtest Date: {sub.index[-1]}")
