# AI Financial Predictor

Una aplicación web basada en Flask para predecir el comportamiento de activos financieros (acciones y criptomonedas) utilizando análisis técnico (RSI, MACD, SMA, Bandas de Bollinger), modelos estadísticos y modelos de Machine Learning preentrenados.

Tabla de contenido
- [Descripción](#descripción)
- [Características principales](#características-principales)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Requisitos e instalación](#requisitos-e-instalación)
- [Uso rápido](#uso-rápido)
- [Detalles técnicos](#detalles-técnicos)
  - [Datos y fuentes](#datos-y-fuentes)
  - [Preprocesamiento](#preprocesamiento)
  - [Modelos](#modelos)
  - [Backtesting y evaluación](#backtesting-y-evaluación)
- [Scripts útiles](#scripts-útiles)
- [Despliegue](#despliegue)
- [Contribuir](#contribuir)
- [Licencia y contacto](#licencia-y-contacto)
- [Notas y advertencias](#notas-y-advertencias)

## Descripción
AI Financial Predictor extrae datos de mercado en tiempo real (o históricos) para generar señales y predicciones de movimiento en distintos horizontes temporales (corto, medio y largo plazo). Proporciona una interfaz web para visualizar indicadores técnicos, resultados de modelos y backtests.

## Características principales
- Conexión a datos de mercado vía yfinance.
- Cálculo de indicadores técnicos: RSI, MACD, SMA, Bandas de Bollinger, entre otros.
- Predicciones con modelos estadísticos y ML/Deep Learning (preentrenados en `models/`).
- Motor de backtesting para validar estrategias y predicciones contra datos históricos.
- Interfaz web con visualizaciones (Chart.js) y diseño (dark mode / glassmorphism).
- Scripts de depuración y utilidades para verificación de datos y noticias.

## Estructura del proyecto (resumen)
- `app.py` — Aplicación Flask principal (servidor web).
- `check_data.py` — Scripts para comprobar calidad/consistencia de datos.
- `debug_api.py`, `debug_news.py` — Scripts de depuración y pruebas para API y noticias.
- `models/` — Modelos preentrenados y/o checkpoints (peso de redes, artefactos).
- `ml model test/` — Experimentos o pruebas de ML (notebooks o scripts de prueba).
- `requirements.txt` — Dependencias Python.
- `static/` — Archivos estáticos (CSS, JS, imágenes).
- `templates/` — Plantillas HTML de Flask.
- `scripts/` — Scripts auxiliares (p. ej. para entrenamiento, conversión o preparación).
- `initial_chat.md` — Notas iniciales o comunicación de diseño.

Si falta alguna carpeta o archivo en este listado es porque puede estar en subdirectorios; puedo poner un árbol completo si lo deseas.

## Requisitos e instalación
Recomendado: crear entorno virtual para aislar dependencias.

1. Clonar el repo:
   ```bash
   git clone https://github.com/thanospower007/finance_prediction.git
   cd finance_prediction
   ```

2. Crear y activar un entorno virtual:
   ```bash
   python -m venv .venv
   source .venv/bin/activate   # Linux / macOS
   .venv\Scripts\activate      # Windows
   ```

3. Instalar dependencias:
   ```bash
   pip install -r requirements.txt
   ```
   Nota: Algunas dependencias (ej. TA-Lib) pueden requerir librerías del sistema. En Linux/Mac puede ser necesario instalar paquetes previos:
   - Debian/Ubuntu: `sudo apt-get install build-essential libatlas-base-dev` y la librería de TA-Lib si usas esa implementación.
   - Alternativa: usar `pandas_ta` si no deseas compilar TA-Lib nativo.

## Uso rápido (arranque local)
1. Iniciar la aplicación:
   ```bash
   python app.py
   ```
2. Abrir el navegador e ir a:
   ```
   http://localhost:5000
   ```

Puntos rápidos:
- Si la app expone endpoints API (p. ej. `/predict`), puedes probar con curl o Postman (ver sección "API" abajo si quieres endpoints detallados).
- Si usas modelos grandes, activa GPU o aumenta timeout según sea necesario.

## Detalles técnicos

### Datos y fuentes
- Fuente principal: yfinance (Yahoo Finance) para precios OHLCV y datos históricos.
- Otros: feeds de noticias (si `debug_news.py` lo utiliza), ficheros CSV locales o fuentes externas según configuración.
- Formato esperado: DataFrame con fecha (timestamp), open, high, low, close, volume.

### Preprocesamiento
- Limpieza de datos: tratamiento de NaNs, resampling si se requiere, ajuste por splits/dividends si aplica.
- Cálculo de indicadores técnicos: funciones para RSI, SMA, MACD, Bollinger Bands se usan para enriquecer features.
- Ventanas de lookback: configurable en scripts de entrenamiento para crear secuencias temporales.

### Modelos
- Ubicación: `models/` (revisa los archivos allí; contienen pesos o artefactos).
- Tipos esperados:
  - Modelos estadísticos (ARIMA, regresión).
  - Modelos ML (RandomForest, XGBoost).
  - Modelos sequential/Deep Learning (LSTM/GRU/Transformer) para series temporales.
- Nota: Incluye instrucciones para cómo re-entrenar o reemplazar modelos en la sección de `scripts/`.

### Backtesting y evaluación
- Métricas típicas a considerar: RMSE/MAPE (predicción de precios), accuracy/precision/recall (si se trata como clasificación de dirección), Sharpe ratio y drawdown para estrategias.
- El backtesting compara las señales del modelo contra datos históricos para estimar rendimiento y riesgos.

## Scripts útiles
- `check_data.py` — Verificar integridad de los datos descargados.
- `debug_api.py` — Probar endpoints o flujos de datos API.
- `debug_news.py` — Depuración/integración de datos de noticias.
- `scripts/` — Puede contener: entrenar (`train.py`), preprocesar (`prepare_data.py`), evaluar (`evaluate.py`). Revisa su contenido para detalles de uso.

(Si quieres, puedo listar el contenido exacto de `scripts/` y proporcionar ejemplos de uso para cada script.)

## API / Endpoints (ejemplo)
Si la aplicación proporciona endpoints, típicamente:
- GET `/` — Dashboard / vista principal
- POST `/predict` — Recibe parámetros (ticker, timeframe, horizon) y devuelve predicción JSON
- GET `/backtest` — Lanza backtest para un rango dado

Ejemplo (curl):
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"ticker":"BTC-USD","period":"1y","horizon":"short"}'
```
(Ajusta el endpoint y payload según la implementación real en `app.py`.)

## Despliegue
- Para producción, usar un servidor WSGI (ej. gunicorn) detrás de un proxy (nginx).
- Ejemplo básico con gunicorn:
  ```bash
  pip install gunicorn
  gunicorn -w 4 -b 0.0.0.0:8000 app:app
  ```
- Considera Dockerizar la app (puedo añadir un Dockerfile si quieres).
- Gestiona secretos/credenciales via variables de entorno — nunca commitees claves en el repo.

## Recomendaciones para reproducibilidad
- Fijar seeds aleatorios en numpy, random y frameworks (PyTorch/TensorFlow) para reproducibilidad.
- Documentar versiones de datasets y parámetros de entrenamiento.
- Guardar configuraciones en archivos (YAML/JSON) y usar logs para experimentos.

## Contribuir
1. Abre un issue describiendo tu propuesta o bug.
2. Crea una rama con prefijo `feature/` o `fix/`.
3. Crea un pull request describiendo los cambios y cómo probarlos.
4. Asegúrate de que las dependencias nuevas vayan en `requirements.txt`.

## Licencia y autor
- Indica aquí la licencia (por defecto no incluida). Si quieres, puedo añadir una licencia sugerida (MIT, Apache 2.0, GPL3).
- Autor: thanospower007 (repositorio: [finance_prediction](https://github.com/thanospower007/finance_prediction))

## Notas y advertencias
- Predicciones en finanzas implican riesgo; usar con precaución y validar con backtests antes de tomar decisiones de trading reales.
- Asegúrate de cumplir términos de servicio de las APIs de datos (yfinance / Yahoo).
- Para producción con dinero real, añade controles de riesgo, límites y procedimientos de audición.
