document.addEventListener('DOMContentLoaded', () => {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const tickerInput = document.getElementById('tickerInput');
    const dateInput = document.getElementById('backtestDate');
    const compareInput = document.getElementById('compareWith');
    const addToWatchlistBtn = document.getElementById('addToWatchlistBtn');
    const watchlistEl = document.getElementById('watchlist');

    const dashboard = document.getElementById('dashboard');
    const loading = document.getElementById('loading');

    let priceChart = null;
    let simulationChart = null;
    let competitionChart = null;
    let currentMainMode = 'analysis';

    // Función auxiliar para formatear números grandes
    function formatBigNumber(num) {
        if (num === null || num === undefined || num === 'N/A' || num === '--') return '--';
        if (typeof num === 'string') num = parseFloat(num);
        if (isNaN(num)) return '--';

        if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
        return `$${num.toFixed(2)}`;
    }

    // UI Mode Switching
    window.switchMainMode = function (mode) {
        currentMainMode = mode;
        // Update Nav Links
        document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.querySelector(`.nav-link[onclick*="${mode}"]`);
        if (activeBtn) activeBtn.classList.add('active');

        // Toggle Visibility
        document.getElementById('search-row-analysis').classList.toggle('hidden', mode !== 'analysis');
        document.getElementById('search-row-simulation').classList.toggle('hidden', mode !== 'simulation');
        document.getElementById('search-row-competition').classList.toggle('hidden', mode !== 'competition');
        document.getElementById('analysis-extra-opts').classList.toggle('hidden', mode !== 'analysis');

        // Reset views
        document.getElementById('dashboard').classList.add('hidden');
        document.getElementById('simulation-dashboard').classList.add('hidden');
        document.getElementById('competition-dashboard').classList.add('hidden');
    };

    // Load Watchlist
    loadWatchlist();

    analyzeBtn.addEventListener('click', () => runAnalysis());

    addToWatchlistBtn.addEventListener('click', () => {
        const item = tickerInput.value.toUpperCase();
        if (item) addToWatchlist(item);
    });

    async function runAnalysis() {
        const ticker = document.getElementById('tickerInput').value.toUpperCase();
        if (!ticker) return;

        const date = document.getElementById('backtestDate').value;
        const compare = document.getElementById('compareWith').value.toUpperCase();
        const modelId = document.getElementById('aiModelSelect').value;

        loading.classList.remove('hidden');
        dashboard.classList.add('hidden');

        try {
            let url = `/api/analyze/${ticker}?model=${modelId}&_t=${Date.now()}`;
            if (date) url += `&date=${date}`;
            if (compare) url += `&compare=${compare}`;

            const response = await fetch(url);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Error al analizar");
            renderDashboard(data);
        } catch (err) {
            alert(err.message);
        } finally {
            loading.classList.add('hidden');
        }
    }

    // --- Simulation Logic ---
    document.getElementById('simulateBtn').addEventListener('click', async () => {
        const ticker = document.getElementById('simTicker').value.toUpperCase();
        const capital = document.getElementById('simCapital').value;
        const date = document.getElementById('simStartDate').value;
        const modelId = document.getElementById('aiModelSelect').value;
        const btn = document.getElementById('simulateBtn');

        if (!ticker) return;

        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Simulacion en proceso...';
        btn.disabled = true;
        btn.style.opacity = '0.7';

        loading.classList.remove('hidden');
        document.getElementById('simulation-dashboard').classList.add('hidden');

        try {
            let url = `/api/simulate?ticker=${ticker}&capital=${capital}&model=${modelId}`;
            if (date) url += `&date=${date}`;

            const response = await fetch(url);
            const data = await response.json();

            loading.classList.add('hidden');
            if (!response.ok) {
                renderSimulationResult(data, true);
                return;
            }

            await renderSimulationResult(data);
        } catch (err) {
            loading.classList.add('hidden');
            renderSimulationResult({ error: err.message }, true);
        } finally {
            btn.innerHTML = '<i class="fas fa-play"></i> Simular Trading';
            btn.disabled = false;
            btn.style.opacity = '1';
        }
    });

    async function renderSimulationResult(data, isError = false) {
        // CRÍTICO: Mostrar el dashboard padre primero
        const dashboard = document.getElementById('dashboard');
        dashboard.classList.remove('hidden');

        const simDashboard = document.getElementById('simulation-dashboard');
        simDashboard.classList.remove('hidden');

        // Scroll suave después de un pequeño delay para asegurar renderizado
        setTimeout(() => {
            simDashboard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);

        // Reset UI
        const statusBadge = document.getElementById('sim-status-badge');
        const progressFill = document.getElementById('sim-progress-fill');

        if (isError) {
            statusBadge.innerText = 'ERROR';
            statusBadge.className = 'badge-live';
            statusBadge.style.background = 'rgba(218, 54, 51, 0.2)';
            statusBadge.style.color = '#ff7b72';
            document.getElementById('sim-live-date').innerText = 'N/A';
            document.getElementById('sim-live-wealth').innerText = 'No hay datos';
            document.getElementById('sim-live-price').innerText = data.error || 'Fallo desconocido';
            return;
        }

        statusBadge.innerText = 'EJECUTANDO...';
        statusBadge.className = 'badge-live';
        progressFill.style.width = '0%';
        document.getElementById('sim-final-ret').innerText = '--';
        document.getElementById('sim-final-pct').innerText = '--';
        document.getElementById('sim-efficiency').innerText = '--';

        const theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
        const gridColor = theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
        const textColor = theme === 'light' ? '#333' : '#e6edf3';

        if (simulationChart) simulationChart.destroy();
        const ctx = document.getElementById('simulationChart').getContext('2d');

        simulationChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Patrimonio (USD)',
                    data: [],
                    borderColor: 'var(--accent-blue)',
                    backgroundColor: 'rgba(88, 166, 255, 0.1)',
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // Disable default animation for speed
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor, maxTicksLimit: 10 } },
                    y: { grid: { color: gridColor }, ticks: { color: textColor } }
                },
                plugins: { legend: { labels: { color: textColor } } }
            }
        });

        // Loop de Animación Pas-a-Paso
        const history = data.history;
        const totalDays = history.length;
        const batchSize = Math.max(1, Math.floor(totalDays / 100)); // Para que no dure una eternidad en periodos largos

        for (let i = 0; i < totalDays; i++) {
            const h = history[i];

            // Update Chart
            simulationChart.data.labels.push(h.date);
            simulationChart.data.datasets[0].data.push(h.value);

            // Update Numeric Stats
            document.getElementById('sim-live-date').innerText = h.date;
            document.getElementById('sim-live-wealth').innerText = `$${h.value.toLocaleString()}`;
            document.getElementById('sim-live-price').innerText = `$${h.price.toLocaleString()}`;

            // Update Progress Bar
            const prog = ((i + 1) / totalDays) * 100;
            document.getElementById('sim-progress-fill').style.width = `${prog}%`;

            // Draw every few frames for performance
            if (i % batchSize === 0 || i === totalDays - 1) {
                simulationChart.update('none');
                // Pequena pausa para efecto visual
                await new Promise(r => setTimeout(r, 20));
            }
        }

        // Final Stats
        statusBadge.innerText = 'FINALIZADO';
        statusBadge.className = 'badge-finished';
        document.getElementById('sim-final-ret').innerText = `$${data.final_value.toLocaleString()}`;
        document.getElementById('sim-final-pct').innerText = `${data.return_pct}%`;
        document.getElementById('sim-final-pct').style.color = data.return_pct >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

        // Calculate Efficiency (Return vs Buy & Hold)
        const initialPrice = history[0].price;
        const finalPrice = history[history.length - 1].price;
        const buyHoldReturn = ((finalPrice - initialPrice) / initialPrice) * 100;
        const efficiency = data.return_pct - buyHoldReturn;

        document.getElementById('sim-efficiency').innerText = (efficiency >= 0 ? '+' : '') + efficiency.toFixed(1) + '%';
        document.getElementById('sim-efficiency-box').style.borderColor = efficiency >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';
    }

    // --- Competition Logic ---
    document.getElementById('competitionBtn').addEventListener('click', async () => {
        loading.classList.remove('hidden');
        try {
            const response = await fetch('/api/competition');
            const data = await response.json();
            renderCompetitionResult(data);
        } catch (err) {
            alert("Error en la batalla AI");
        } finally {
            loading.classList.add('hidden');
        }
    });

    function renderCompetitionResult(data) {
        // CRÍTICO: Mostrar el dashboard padre primero
        const dashboard = document.getElementById('dashboard');
        dashboard.classList.remove('hidden');

        const compDashboard = document.getElementById('competition-dashboard');
        compDashboard.classList.remove('hidden');

        const labels = Object.keys(data).map(id => id.toUpperCase());
        const values = Object.values(data).map(d => d.return);

        const theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
        const gridColor = theme === 'light' ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.05)';
        const textColor = theme === 'light' ? '#333' : '#e6edf3';

        if (competitionChart) competitionChart.destroy();
        const ctx = document.getElementById('competitionChart').getContext('2d');
        competitionChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Retorno % (Cartera Aleatoria)',
                    data: values,
                    backgroundColor: values.map(v => v >= 0 ? 'rgba(46, 160, 67, 0.7)' : 'rgba(218, 54, 51, 0.7)')
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor } },
                    y: { grid: { display: false }, ticks: { color: textColor } }
                },
                plugins: { legend: { labels: { color: textColor } } }
            }
        });
    }

    function renderDashboard(data) {
        dashboard.classList.remove('hidden');

        // 1. Populate Main Panel (A)
        populatePanel('a', data.main);

        // 2. Handle Comparison Panel (B) & Stats Table
        const splitContainer = document.querySelector('.split-view-container');
        const panelB = document.getElementById('panel-b');
        const compSection = document.getElementById('comparison-section');

        if (data.comparison) {
            splitContainer.classList.add('active-split');
            panelB.classList.remove('hidden');
            compSection.classList.remove('hidden');
            populatePanel('b', data.comparison);

            // Populate Table
            updateComparisonTable(data.main, data.comparison);

            // Render Bar Chart
            renderComparisonChart(data.main, data.comparison);

            document.getElementById('chart-title').innerText = `Comparación de Precio (USD)`;
        } else {
            splitContainer.classList.remove('active-split');
            panelB.classList.add('hidden');
            compSection.classList.add('hidden');
            document.getElementById('chart-title').innerText = `Evolución de Precio (USD)`;
        }

        // 3. Render Chart
        renderChart(data.main, data.comparison);

        // 4. Render AI Insights (Feature Importance)
        if (data.main.ai_analysis) {
            renderFeatureImportance(data.main.ai_analysis, 'a');
        }
        if (data.comparison && data.comparison.ai_analysis) {
            renderFeatureImportance(data.comparison.ai_analysis, 'b');
        }

        // --- Winner Badge Logic ---
        document.querySelectorAll('.winner-badge').forEach(el => el.remove());
        document.querySelectorAll('.asset-card').forEach(el => el.classList.remove('winner-glow'));

        if (data.comparison && data.comparison.recommendation && data.main.recommendation) {
            const scoreA = data.main.recommendation.score;
            const scoreB = data.comparison.recommendation.score;
            let winner = null;

            if (scoreA > scoreB) winner = 'a';
            else if (scoreB > scoreA) winner = 'b';

            if (winner) {
                const headerName = document.getElementById(`assetName-${winner}`);
                if (headerName) {
                    const badge = document.createElement('div');
                    badge.className = 'winner-badge';
                    badge.innerHTML = `<i class="fas fa-trophy"></i> Mejor Opción (${winner === 'a' ? scoreA : scoreB} pts)`;
                    headerName.parentElement.appendChild(badge);

                    // Add Glow
                    const card = headerName.closest('.asset-card');
                    if (card) card.classList.add('winner-glow');
                }
            }
        }
    }

    function populatePanel(suffix, d) {
        // Validación defensiva
        if (!d) {
            console.error('populatePanel: datos vacíos para suffix', suffix);
            return;
        }

        // Asset Info
        document.getElementById(`assetName-${suffix}`).innerText = d.ticker || '--';
        if (document.getElementById(`assetFullName-${suffix}`))
            document.getElementById(`assetFullName-${suffix}`).innerText = d.full_name || "";

        document.getElementById(`currentPrice-${suffix}`).innerText = d.current_price ? `$${d.current_price} USD` : '--';

        // Fundamentals con validación
        const fundamentals = d.fundamentals || {};
        document.getElementById(`fund-mcap-${suffix}`).innerText = formatBigNumber(fundamentals.market_cap);
        document.getElementById(`fund-pe-${suffix}`).innerText = fundamentals.pe_ratio || '--';

        // Badge
        const badge = document.getElementById(`simulation-badge-${suffix}`);
        if (badge) {
            if (d.is_backtest) badge.classList.remove('hidden');
            else badge.classList.add('hidden');
        }

        // ML (Multi-Timeframe)
        const gridEl = document.getElementById(`ai-grid-${suffix}`);
        const btEl = document.getElementById(`bt-outcomes-${suffix}`);
        if (gridEl) gridEl.innerHTML = '';
        if (btEl) {
            btEl.innerHTML = '';
            btEl.className = '';
        }

        if (d.ml_predictions) {
            const horizons = [
                { k: 'short', label: 'Corto Plazo (2 Sem.)' },
                { k: 'medium', label: 'Medio Plazo (6 Meses)' },
                { k: 'long', label: 'Largo Plazo (2 Años)' }
            ];

            horizons.forEach(h => {
                const pred = d.ml_predictions[h.k];
                if (!pred) return;

                const card = document.createElement('div');

                // Determine CSS State
                let stateClass = 'signal-neutral';
                let color = '#d29922';
                let icon = '<i class="fas fa-minus"></i>';

                if (pred.signal === 'SUBE') {
                    stateClass = 'signal-up';
                    color = '#2ea043';
                    icon = '<i class="fas fa-arrow-up"></i>';
                } else if (pred.signal === 'BAJA') {
                    stateClass = 'signal-down';
                    color = '#da3633';
                    icon = '<i class="fas fa-arrow-down"></i>';
                }

                card.className = `pred-card ${stateClass}`;

                card.innerHTML = `
                    <div class="pred-horizon">${h.label}</div>
                    <div class="pred-signal" style="color:${color}">
                        ${icon} ${pred.signal}
                    </div>
                    <div class="pred-conf">
                        <i class="fas fa-bullseye" style="font-size:0.7em; opacity:0.7"></i> Confianza: ${pred.confidence}%
                    </div>
                    <div class="pred-conf" style="font-size:0.65rem; opacity:0.6">
                        (Precisión Modelo: ${pred.accuracy}%)
                    </div>
                `;
                gridEl.appendChild(card);
            });
        }

        // Backtest Outcomes (Real Results)
        if (d.is_backtest && d.actual_outcomes) {
            btEl.className = 'backtest-outcomes';

            if (d.actual_outcomes.error) {
                btEl.innerHTML = `
                    <div class="bt-title">⚠️ Datos Insuficientes</div>
                    <div style="font-size:0.9em; opacity:0.8; padding:10px; color: #ff7b72;">
                        ${d.actual_outcomes.error}
                    </div>
                `;
            } else {
                let html = '<div class="bt-title">🏁 Resultado Real (vs Fecha Simulada)</div><div class="bt-grid">';

                const mapping = {
                    'short': '2 Semanas',
                    'medium': '6 Meses',
                    'long': '2 Años'
                };

                const order = ['short', 'medium', 'long'];

                order.forEach(key => {
                    const val = d.actual_outcomes[key];
                    if (!val) return;

                    const sign = val.change_pct >= 0 ? '+' : '';
                    const color = val.change_pct >= 0 ? '#2ea043' : '#da3633';

                    html += `
                    <div class="bt-item">
                        <span class="bt-label">${mapping[key] || key}</span>
                        <span class="bt-val" style="color:${color}">${sign}${val.change_pct}%</span>
                        <span style="font-size:0.7rem; color:#888">$${val.price_t}</span>
                    </div>
                `;
                });
                html += '</div>';
                btEl.innerHTML = html;
            }
        }

        // Sentiment (Enhanced with % display)
        const emojiEl = document.getElementById(`sentiment-emoji-${suffix}`);
        const listEl = document.getElementById(`headlines-list-${suffix}`);
        if (listEl) listEl.innerHTML = '';
        if (!emojiEl || !listEl) return;

        // Add sentiment percentage badge
        const sentScore = d.sentiment.polarity; // -1 to 1
        const sentPercent = Math.round(((sentScore + 1) / 2) * 100); // 0 to 100%
        const sentBadge = `<div style="display:inline-block; background:rgba(46,160,67,0.2); padding:4px 10px; border-radius:12px; margin-left:8px; font-size:0.85em;">▲ ${sentPercent}% Positivo</div>`;

        if (d.sentiment.headlines.length === 0) {
            emojiEl.innerHTML = '🤷‍♂️ ' + sentBadge;
            listEl.innerHTML = '<div class="no-news">📭 No hay noticias recientes disponibles para este activo por el momento.</div>';
        } else {
            let emoji = '😐';
            if (d.sentiment.signal === 'POSITIVE') emoji = '🚀';
            else if (d.sentiment.signal === 'NEGATIVE') emoji = '🐻';
            emojiEl.innerHTML = emoji + ' ' + sentBadge;

            d.sentiment.headlines.forEach(n => {
                const div = document.createElement('div');
                div.className = 'news-item';

                // Layout: 
                // 1. Header (Title)
                // 2. Meta Row (Source | Date | Arrow)
                // 3. Summary (Hidden)

                div.innerHTML = `
                    <div class="news-header">
                        <a href="${n.url}" target="_blank" class="news-title-link">${n.title}</a>
                    </div>
                    <div class="news-meta-row">
                        <div>
                            <a href="${n.url}" target="_blank" class="news-source">${n.source}</a>
                            <span> • ${n.time}</span>
                        </div>
                        <button class="toggle-summary" title="Ver resumen">▼</button>
                    </div>
                    <div class="news-summary hidden">${n.summary}</div>
                `;

                // Add Toggle Event
                const toggleBtn = div.querySelector('.toggle-summary');
                const summaryDiv = div.querySelector('.news-summary');

                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent bubbling
                    const isHidden = summaryDiv.classList.contains('hidden');
                    if (isHidden) {
                        summaryDiv.classList.remove('hidden');
                        toggleBtn.classList.add('rotated');
                    } else {
                        summaryDiv.classList.add('hidden');
                        toggleBtn.classList.remove('rotated');
                    }
                });

                listEl.appendChild(div);
            });
        }
    }

    function updateComparisonTable(a, b) {
        document.getElementById('th-asset-a').innerText = a.ticker;
        document.getElementById('th-asset-b').innerText = b.ticker;

        document.getElementById('comp-price-a').innerText = `$${a.current_price}`;
        document.getElementById('comp-price-b').innerText = `$${b.current_price}`;

        document.getElementById('comp-beta-a').innerText = a.fundamentals.beta || "N/A";
        document.getElementById('comp-beta-b').innerText = b.fundamentals.beta || "N/A";

        document.getElementById('comp-vol-a').innerText = `${a.stats.volatility}%`;
        document.getElementById('comp-vol-b').innerText = `${b.stats.volatility}%`;

        document.getElementById('comp-trend-a').innerText = a.stats.trend;
        document.getElementById('comp-trend-b').innerText = b.stats.trend;

        document.getElementById('comp-pe-a').innerText = a.fundamentals.pe_ratio || "--";
        document.getElementById('comp-pe-b').innerText = b.fundamentals.pe_ratio || "--";

        document.getElementById('comp-fpe-a').innerText = a.fundamentals.forward_pe || "--";
        document.getElementById('comp-fpe-b').innerText = b.fundamentals.forward_pe || "--";

        document.getElementById('comp-eps-a').innerText = a.fundamentals.eps || "--";
        document.getElementById('comp-eps-b').innerText = b.fundamentals.eps || "--";

        const divA = a.fundamentals.dividend_yield ? (a.fundamentals.dividend_yield * 100).toFixed(2) + '%' : '0%';
        const divB = b.fundamentals.dividend_yield ? (b.fundamentals.dividend_yield * 100).toFixed(2) + '%' : '0%';
        document.getElementById('comp-div-a').innerText = divA;
        document.getElementById('comp-div-b').innerText = divB;

        document.getElementById('comp-high-a').innerText = `$${a.fundamentals.high_52w || '--'}`;
        document.getElementById('comp-high-b').innerText = `$${b.fundamentals.high_52w || '--'}`;
        document.getElementById('comp-low-a').innerText = `$${a.fundamentals.low_52w || '--'}`;
        document.getElementById('comp-low-b').innerText = `$${b.fundamentals.low_52w || '--'}`;

        // Technicals
        document.getElementById('comp-rsi-a').innerText = a.stats.rsi;
        document.getElementById('comp-rsi-b').innerText = b.stats.rsi;
        document.getElementById('comp-macd-a').innerText = a.stats.macd;
        document.getElementById('comp-macd-b').innerText = b.stats.macd;
        document.getElementById('comp-sma50-a').innerText = `${a.stats.sma_50_dist}%`;
        document.getElementById('comp-sma50-b').innerText = `${b.stats.sma_50_dist}%`;
        document.getElementById('comp-sma200-a').innerText = `${a.stats.sma_200_dist}%`;
        document.getElementById('comp-sma200-b').innerText = `${b.stats.sma_200_dist}%`;
    }

    // --- Watchlist Functions ---
    function loadWatchlist() {
        const saved = JSON.parse(localStorage.getItem('watchlist') || '[]');
        watchlistEl.innerHTML = '';
        saved.forEach(item => {
            const li = document.createElement('li');
            li.className = 'watchlist-item';
            li.innerHTML = `
                <span onclick="loadTicker('${item}')">${item}</span>
                <span class="del-btn" onclick="removeFromWatchlist('${item}')">✖</span>
            `;
            watchlistEl.appendChild(li);
        });
    }

    window.addToWatchlist = function (ticker) {
        const saved = JSON.parse(localStorage.getItem('watchlist') || '[]');
        if (!saved.includes(ticker)) {
            saved.push(ticker);
            localStorage.setItem('watchlist', JSON.stringify(saved));
            loadWatchlist();
        }
    };

    window.removeFromWatchlist = function (ticker) {
        let saved = JSON.parse(localStorage.getItem('watchlist') || '[]');
        saved = saved.filter(i => i !== ticker);
        localStorage.setItem('watchlist', JSON.stringify(saved));
        loadWatchlist();
    }

    window.loadTicker = function (ticker) {
        tickerInput.value = ticker;
        runAnalysis();
    }

    // --- Chart ---
    function renderChart(mainData, compData) {
        const ctx = document.getElementById('priceChart').getContext('2d');
        if (priceChart) priceChart.destroy();

        const isComparison = !!compData;
        const datasets = [];

        // Since both are now USD, we compare PRICES directly.
        // User requested: "pon todas las divisas en dolares... no en porcentaje"

        // Determine Color based on Signal
        let lineColor = '#58a6ff'; // Default Blue
        let bgColor = 'rgba(88, 166, 255, 0.1)';

        if (mainData.recommendation) {
            const c = mainData.recommendation.color;
            if (c === 'red') {
                lineColor = '#da3633';
                bgColor = 'rgba(218, 54, 51, 0.2)';
            } else if (c === 'yellow') {
                lineColor = '#d29922';
                bgColor = 'rgba(210, 153, 34, 0.2)';
            } else if (c === 'green') {
                lineColor = '#2ea043';
                bgColor = 'rgba(46, 160, 67, 0.2)';
            }
        }

        // Validación defensiva
        if (!mainData.chart_data || !mainData.chart_data.dates || !mainData.chart_data.prices) {
            console.error('renderChart: chart_data inválido', mainData);
            return;
        }

        datasets.push({
            label: `${mainData.ticker} (USD)`,
            data: mainData.chart_data.prices,
            borderColor: lineColor,
            backgroundColor: bgColor,
            borderWidth: 2,
            fill: !isComparison,
            pointRadius: 0
        });

        if (isComparison) {
            datasets.push({
                label: `${compData.ticker} (USD)`,
                data: compData.chart_data.prices,
                borderColor: '#d29922',
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            });
        }
        else {
            datasets.push(
                {
                    label: 'Cloud A',
                    data: mainData.chart_data.ichimoku_a,
                    borderColor: 'rgba(46, 160, 67, 0.4)',
                    backgroundColor: 'rgba(46, 160, 67, 0.05)',
                    borderWidth: 1, pointRadius: 0, fill: '+1'
                },
                {
                    label: 'Cloud B',
                    data: mainData.chart_data.ichimoku_b,
                    borderColor: 'rgba(218, 54, 51, 0.4)',
                    backgroundColor: 'rgba(218, 54, 51, 0.05)',
                    borderWidth: 1, pointRadius: 0, fill: false
                }
            );
        }

        const theme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
        const gridColor = theme === 'light' ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)';
        const textColor = theme === 'light' ? '#333' : '#e6edf3';

        priceChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: mainData.chart_data.dates,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                elements: { point: { radius: 0 } },
                scales: {
                    x: { grid: { color: gridColor }, ticks: { color: textColor } },
                    y: {
                        grid: { color: gridColor },
                        ticks: {
                            color: textColor,
                            callback: function (value) { return '$' + value; }
                        }
                    }
                },
                plugins: { legend: { labels: { color: textColor } } }
            }
        });
    }

    // --- Helpers ---
    function formatBigNumber(num) {
        if (!num || num === 'N/A') return 'N/A';
        if (num >= 1.0e+12) return (num / 1.0e+12).toFixed(2) + " T";
        if (num >= 1.0e+9) return (num / 1.0e+9).toFixed(2) + " B";
        if (num >= 1.0e+6) return (num / 1.0e+6).toFixed(2) + " M";
        return num;
    }

    // --- Comparison Chart & Toggles ---
    let compChartInstance = null;

    window.switchComparisonView = function (mode) {
        const tableDiv = document.getElementById('comp-table-view');
        const chartDiv = document.getElementById('comp-chart-view');
        const btns = document.querySelectorAll('.toggle-btn');

        if (mode === 'table') {
            tableDiv.classList.remove('hidden');
            chartDiv.classList.add('hidden');
            btns[0].classList.add('active');
            btns[1].classList.remove('active');
        } else {
            tableDiv.classList.add('hidden');
            chartDiv.classList.remove('hidden');
            btns[0].classList.remove('active');
            btns[1].classList.add('active');
        }
    }

    function renderComparisonChart(a, b) {
        const ctx = document.getElementById('comparisonBarChart').getContext('2d');
        if (compChartInstance) compChartInstance.destroy();

        // Agregamos importancia de características para ambos activos
        const featA = a.ai_analysis.feature_importance;
        const featB = b.ai_analysis.feature_importance;

        const allKeys = Array.from(new Set([...Object.keys(featA), ...Object.keys(featB)]));

        // Ordenamos por la importancia media
        allKeys.sort((k1, k2) => {
            const avg1 = ((featA[k1] || 0) + (featB[k1] || 0)) / 2;
            const avg2 = ((featA[k2] || 0) + (featB[k2] || 0)) / 2;
            return avg2 - avg1;
        });

        const topKeys = allKeys.slice(0, 10);
        const labels = topKeys.map(k => k.replace(/_/g, ' ').toUpperCase());
        const dataA = topKeys.map(k => (featA[k] || 0) * 100);
        const dataB = topKeys.map(k => (featB[k] || 0) * 100);

        compChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: a.ticker,
                        data: dataA,
                        backgroundColor: 'rgba(54, 162, 235, 0.6)',
                        borderColor: 'rgba(54, 162, 235, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: b.ticker,
                        data: dataB,
                        backgroundColor: 'rgba(255, 99, 132, 0.6)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: { color: document.body.classList.contains('light-mode') ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)' },
                        ticks: { color: document.body.classList.contains('light-mode') ? '#333' : '#8b949e' },
                        title: { display: true, text: 'Importancia en Predicción (%)', color: document.body.classList.contains('light-mode') ? '#333' : '#8b949e' }
                    },
                    y: {
                        grid: { display: false },
                        ticks: { color: document.body.classList.contains('light-mode') ? '#333' : '#e6edf3' }
                    }
                },
                plugins: {
                    legend: { labels: { color: document.body.classList.contains('light-mode') ? '#333' : '#e6edf3' } },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `${context.dataset.label}: ${context.raw.toFixed(2)}% de peso`;
                            }
                        }
                    }
                }
            }
        });
    }

    // Expose renderComparisonChart to global if needed or keep local since renderDashboard calls it
    // But renderDashboard is inside? Yes. So local is fine.

    // --- Export ---
    window.exportReport = function () {
        const element = document.querySelector('.main-content');
        const ticker = document.getElementById('tickerInput').value || 'Reporte';

        const opt = {
            margin: [10, 10, 10, 10],
            filename: `Analisis_${ticker}_${new Date().toISOString().split('T')[0]}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: {
                scale: 2,
                useCORS: true,
                backgroundColor: getComputedStyle(document.body).backgroundColor
            },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'vertical' }
        };

        html2pdf().set(opt).from(element).save();
    }

    window.setAlert = async function () {
        const price = document.getElementById('alert-price').value;
        const condition = document.getElementById('alert-condition').value;
        const ticker = document.getElementById('assetName').innerText;

        if (!price) return;

        await fetch('/api/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ticker, price, condition })
        });
        alert('Alerta creada con éxito');
    }

    // Theme Toggle Logic
    const themeToggle = document.getElementById('themeToggle');

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        if (themeToggle) themeToggle.innerText = '🌓 Modo Oscuro';
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-mode');
            const isLight = document.body.classList.contains('light-mode');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            themeToggle.innerText = isLight ? '🌓 Modo Oscuro' : '🌓 Modo Claro';
        });
    }
});

// --- AI FEATURE IMPORTANCE ---
let featureImportanceCharts = { a: null, b: null };
function renderFeatureImportance(analysis, suffix) {
    const canvasId = `featureImportanceChart-${suffix}`;
    const canvasEl = document.getElementById(canvasId);
    if (!canvasEl) return;

    // Validación defensiva
    if (!analysis || !analysis.feature_importance) {
        console.error('renderFeatureImportance: analysis inválido', analysis);
        return;
    }

    const ctx = canvasEl.getContext('2d');
    const { feature_importance, current_values } = analysis;

    const sortedFeatures = Object.entries(feature_importance)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10); // Top 10

    if (sortedFeatures.length === 0) {
        console.warn('renderFeatureImportance: no hay características para mostrar');
        return;
    }

    const labels = sortedFeatures.map(f => f[0].replace('_', ' ').toUpperCase());
    const dataValues = sortedFeatures.map(f => f[1] * 100);

    const backgroundColors = sortedFeatures.map(([name, weight]) => {
        const val = current_values[name];
        // STRICT RED/GREEN LOGIC
        if (name === 'rsi') return (val < 50) ? '#2ea043' : '#da3633';
        if (name === 'pe_ratio') return (val < 25) ? '#2ea043' : '#da3633';
        if (name.includes('macd')) return (val > 0) ? '#2ea043' : '#da3633';
        if (name === 'beta') return (val < 1.0) ? '#2ea043' : '#da3633';
        if (name.includes('sma')) return (current_values['Close'] > val) ? '#2ea043' : '#da3633';
        return (val > 0 || weight > 0) ? '#2ea043' : '#da3633';
    });

    if (featureImportanceCharts[suffix]) featureImportanceCharts[suffix].destroy();
    featureImportanceCharts[suffix] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                data: dataValues,
                backgroundColor: backgroundColors,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: document.body.classList.contains('light-mode') ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.05)' },
                    ticks: { color: document.body.classList.contains('light-mode') ? '#333' : '#8b949e' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: document.body.classList.contains('light-mode') ? '#333' : '#e6edf3' }
                }
            }
        }
    });
}
