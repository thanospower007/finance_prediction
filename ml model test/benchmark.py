import yfinance as yf
import pandas as pd
import numpy as np
import ta
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.neural_network import MLPClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.discriminant_analysis import LinearDiscriminantAnalysis
from sklearn.neighbors import KNeighborsClassifier
from sklearn.gaussian_process import GaussianProcessClassifier
from sklearn.gaussian_process.kernels import RBF
from sklearn.metrics import accuracy_score
import xgboost as xgb
import warnings
import time
from tqdm import tqdm # Importante: requiere 'pip install tqdm'

warnings.filterwarnings('ignore')

# --- CONFIGURACIÓN ---
TICKERS = ["AAPL", "MSFT", "GOOGL", "AMZN", "META", "TSLA", "NVDA", "JPM", "V", "PG"]
HORIZON = 10  # Predecir a 10 días
THRESHOLD = 0.02  # 2% para definir Sube o Baja

def calculate_indicators(df):
    """Calcula indicadores técnicos usando la librería 'ta'."""
    df = df.copy()
    # Técnicos base
    df['rsi'] = ta.momentum.RSIIndicator(df['Close'], window=14).rsi()
    macd = ta.trend.MACD(df['Close'])
    df['macd'] = macd.macd()
    df['macd_signal'] = macd.macd_signal()
    df['sma_50'] = ta.trend.SMAIndicator(df['Close'], window=50).sma_indicator()
    df['sma_200'] = ta.trend.SMAIndicator(df['Close'], window=200).sma_indicator()
    
    bollinger = ta.volatility.BollingerBands(df['Close'], window=20, window_dev=2)
    df['bb_high'] = bollinger.bollinger_hband()
    df['bb_low'] = bollinger.bollinger_lband()
    
    # Ichimoku
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

def get_data():
    """Descarga datos y prepara el dataset con barra de progreso."""
    all_data = []
    print("Iniciando fase de recolección de datos...")
    
    # Barra de progreso para la descarga de Tickers
    for ticker in tqdm(TICKERS, desc="Procesando activos"):
        try:
            t = yf.Ticker(ticker)
            df = t.history(period="5y")
            if len(df) < 500: continue
            
            df = calculate_indicators(df)
            
            # Variables fundamentales (Nota: Estos datos de t.info son actuales)
            info = t.info
            df['beta'] = info.get('beta', 1.0)
            df['pe_ratio'] = info.get('trailingPE', 20.0)
            df['market_cap_normalized'] = np.log10(info.get('marketCap', 1e12))
            
            # Volatilidad y distancias
            df['volatility_annualized'] = df['Close'].pct_change().rolling(252).std() * (252**0.5)
            h52 = df['High'].rolling(252).max()
            l52 = df['Low'].rolling(252).min()
            df['dist_52w_high'] = (df['Close'] - h52) / h52
            df['dist_52w_low'] = (df['Close'] - l52) / l52
            
            # Target (0=Baja, 1=Neutral, 2=Sube)
            future_price = df['Close'].shift(-HORIZON)
            returns = (future_price - df['Close']) / df['Close']
            df['target'] = returns.apply(lambda r: 2 if r > THRESHOLD else (0 if r < -THRESHOLD else 1))
            
            all_data.append(df.dropna())
        except Exception:
            continue
            
    return pd.concat(all_data)

# --- PROCESO PRINCIPAL ---
data = get_data()
features = ['rsi', 'macd', 'macd_signal', 'sma_50', 'sma_200', 'bb_high', 'bb_low', 
            'senkou_span_a', 'senkou_span_b', 'beta', 'pe_ratio',
            'market_cap_normalized', 'volatility_annualized',
            'dist_52w_high', 'dist_52w_low']

X = data[features]
y = data['target']

# División CRONOLÓGICA (Crucial para series temporales: shuffle=False)
X_train_raw, X_test_raw, y_train, y_test = train_test_split(X, y, test_size=0.2, shuffle=False)

# Escalado correcto (Ajustar solo con TRAIN para evitar fuga de información)
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train_raw)
X_test = scaler.transform(X_test_raw)

# Lista de modelos a evaluar
models = [
    ("Logistic Regression", LogisticRegression(multi_class='multinomial')),
    ("SVM (RBF)", SVC(kernel='rbf', probability=True)),
    ("MLP Neural Net", MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500)),
    ("XGBoost", xgb.XGBClassifier(objective='multi:softmax', num_class=3, verbosity=0)),
    ("K-Nearest Neighbors", KNeighborsClassifier(n_neighbors=5)),
    ("Gaussian NB", GaussianNB()),
    ("LDA", LinearDiscriminantAnalysis())
]

results = []

print(f"\nDataset listo con {len(data)} registros. Iniciando entrenamiento...")

# Barra de progreso para el entrenamiento de modelos
for name, model in tqdm(models, desc="Entrenando modelos"):
    start = time.time()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    duration = time.time() - start
    results.append({"Modelo": name, "Accuracy": acc, "Tiempo (s)": round(duration, 2)})

# --- RESULTADOS ---
print("\n" + "="*60)
results_df = pd.DataFrame(results).sort_values(by="Accuracy", ascending=False)
print(results_df.to_string(index=False))
print("="*60)

winner = results_df.iloc[0]['Modelo']
print(f"\nGANADOR RECOMENDADO: {winner}")