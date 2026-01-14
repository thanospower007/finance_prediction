import yfinance as yf
import pandas as pd
import numpy as np
import ta
import joblib
import os
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.neighbors import KNeighborsClassifier
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb

# Configuración
TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "JPM", "V", "PG",
    "UNH", "HD", "MA", "ABBV", "BAC", "PFE", "AVGO", "COST", "DIS", "ADBE"
]
MODELS_DIR = "models"
HORIZON = 10
THRESHOLD = 0.02

if not os.path.exists(MODELS_DIR):
    os.makedirs(MODELS_DIR)

def calculate_indicators(df):
    df = df.copy()
    df['rsi'] = ta.momentum.RSIIndicator(df['Close'], window=14).rsi()
    macd = ta.trend.MACD(df['Close'])
    df['macd'] = macd.macd()
    df['macd_signal'] = macd.macd_signal()
    df['sma_50'] = ta.trend.SMAIndicator(df['Close'], window=50).sma_indicator()
    df['sma_200'] = ta.trend.SMAIndicator(df['Close'], window=200).sma_indicator()
    bollinger = ta.volatility.BollingerBands(df['Close'], window=20, window_dev=2)
    df['bb_high'] = bollinger.bollinger_hband()
    df['bb_low'] = bollinger.bollinger_lband()
    df['ema_12'] = ta.trend.EMAIndicator(df['Close'], window=12).ema_indicator()
    df['ema_26'] = ta.trend.EMAIndicator(df['Close'], window=26).ema_indicator()
    
    h9 = df['High'].rolling(9).max()
    l9 = df['Low'].rolling(9).min()
    df['tenkan_sen'] = (h9 + l9) / 2
    h26 = df['High'].rolling(26).max()
    l26 = df['Low'].rolling(26).min()
    df['kijun_sen'] = (h26 + l26) / 2
    df['senkou_span_a'] = ((df['tenkan_sen'] + df['kijun_sen']) / 2).shift(26)
    h52 = df['High'].rolling(52).max()
    l52 = df['Low'].rolling(52).min()
    df['senkou_span_b'] = ((h52 + l52) / 2).shift(26)
    
    return df

def get_training_data():
    all_rows = []
    print("Recopilando datos históricos...")
    for ticker in TICKERS:
        try:
            print(f"Procesando {ticker}...")
            t = yf.Ticker(ticker)
            df = t.history(period="10y")
            if len(df) < 500: continue
            
            df = calculate_indicators(df)
            
            # Fundamentales estáticos (promediados para entrenamiento general)
            info = t.info
            df['beta'] = info.get('beta', 1.0)
            df['pe_ratio'] = info.get('trailingPE', 20.0)
            df['dividend_yield'] = info.get('dividendYield', 0.0)
            df['eps'] = info.get('trailingEps', 5.0)
            df['forward_pe'] = info.get('forwardPE', 18.0)
            df['market_cap_normalized'] = np.log10(info.get('marketCap', 1e11))
            df['volatility_annualized'] = df['Close'].pct_change().rolling(252).std() * (252**0.5)
            
            h52 = df['High'].rolling(252).max()
            l52 = df['Low'].rolling(252).min()
            df['dist_52w_high'] = (df['Close'] - h52) / h52
            df['dist_52w_low'] = (df['Close'] - l52) / l52
            
            # Sentiment Score (placeholder neutral para entrenamiento masivo)
            # En producción, se calcula dinámicamente por ticker/fecha
            df['sentiment_score'] = 0.0  # Neutral baseline
            
            # Target
            future_price = df['Close'].shift(-HORIZON)
            returns = (future_price - df['Close']) / df['Close']
            
            def classify(ret):
                if ret > THRESHOLD: return 2
                if ret < -THRESHOLD: return 0
                return 1
            
            df['target'] = returns.apply(classify)
            all_rows.append(df.dropna())
        except Exception as e:
            print(f"Error con {ticker}: {e}")
            
    return pd.concat(all_rows)

print("Iniciando Pre-entrenamiento Maestro...")
data = get_training_data()
features = ['rsi', 'macd', 'macd_signal', 'sma_50', 'sma_200', 'bb_high', 'bb_low', 
            'ema_12', 'ema_26', 'senkou_span_a', 'senkou_span_b', 'beta', 'pe_ratio',
            'market_cap_normalized', 'dividend_yield', 'volatility_annualized',
            'eps', 'forward_pe', 'dist_52w_high', 'dist_52w_low']

X = data[features]
y = data['target']

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
joblib.dump(scaler, os.path.join(MODELS_DIR, "scaler.joblib"))
joblib.dump(features, os.path.join(MODELS_DIR, "features.joblib"))

models = {
    "logistic": LogisticRegression(multi_class='multinomial', max_iter=1000),
    "svm": SVC(kernel='rbf', probability=True),
    "mlp": MLPClassifier(hidden_layer_sizes=(128, 64, 32), activation='tanh', max_iter=1000),
    "nb": GaussianNB(),
    "lda": LinearDiscriminantAnalysis(),
    "xgboost": xgb.XGBClassifier(objective='multi:softmax', num_class=3),
    "dt": DecisionTreeClassifier(max_depth=20),
    "rf": RandomForestClassifier(n_estimators=100),
    "knn": KNeighborsClassifier(n_neighbors=10, weights='distance'),
    "ridge": LogisticRegression(penalty='l2', solver='lbfgs', multi_class='multinomial') 
}

for name, model in models.items():
    print(f"Entrenando {name}...")
    model.fit(X_scaled, y)
    joblib.dump(model, os.path.join(MODELS_DIR, f"{name}.joblib"))
    print(f"Guardado models/{name}.joblib")

print("¡Pre-entrenamiento masivo completado con éxito!")
