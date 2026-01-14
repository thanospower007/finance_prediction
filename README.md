# AI Financial Predictor

A Flask-based web application that predicts stock and crypto movements using technical analysis (RSI, MACD, SMA, Bollinger Bands).

## Features
- **Real-Time Analysis**: Direct connection to market data via yfinance.
- **Deep Learning**: Uses statistical models to predict Short, Medium, and Long term trends.
- **Backtesting Engine**: Travel back in time to verify predictions against historical data.
- **Premium UI**: Dark mode, glassmorphism design.

## How to Run

1.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```
2.  Run the app:
    ```bash
    python app.py
    ```
3.  Visit `http://localhost:5000`

## Tech Stack
-   **Backend**: Python, Flask, Pandas, TA-Lib, YFinance.
-   **Frontend**: HTML5, CSS3, JavaScript, Chart.js.
