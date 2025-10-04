// const API_BASE = "https://api-pub.bitfinex.com/v2";
// const API_BASE = "http://localhost:8080/bitfinex/v2";
// const API_BASE ="https://nder47i921.execute-api.eu-west-2.amazonaws.com"
const API_BASE = "https://bitfines-proxy.bonnemai.workers.dev/v2"
const SUPPORTED_RESOLUTIONS = new Map([
  ["1m", "1m"],
  ["5m", "5m"],
  ["15m", "15m"],
  ["30m", "30m"],
  ["1h", "1h"],
  ["3h", "3h"],
  ["6h", "6h"],
  ["12h", "12h"],
  ["1d", "1D"],
]);

const charts = {
  combinedHistory: null,
  regression: null,
  residuals: null,
};

async function fetchCandleHistory(symbol, resolution, limit) {
  const url = `${API_BASE}/candles/trade:${resolution}:${symbol}/hist?limit=${limit}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request for ${symbol} failed with status ${response.status}`);
  }
  const raw = await response.json();
  return raw
    .map((entry) => ({
      timestamp: entry[0],
      open: entry[1],
      close: entry[2],
      high: entry[3],
      low: entry[4],
      volume: entry[5],
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

function mergeSeries(assetASeries, assetBSeries) {
  const assetBByTs = new Map(assetBSeries.map((item) => [item.timestamp, item]));
  return assetASeries
    .filter((item) => assetBByTs.has(item.timestamp))
    .map((item) => ({
      timestamp: item.timestamp,
      assetA: item.close,
      assetB: assetBByTs.get(item.timestamp).close,
    }));
}

function computeRegression(pairs) {
  const n = pairs.length;
  if (!n) {
    return null;
  }

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  pairs.forEach((point) => {
    sumX += point.assetB;
    sumY += point.assetA;
    sumXY += point.assetB * point.assetA;
    sumX2 += point.assetB * point.assetB;
  });

  const meanY = sumY / n;
  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) {
    return null;
  }

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = meanY - slope * (sumX / n);

  let ssRes = 0;
  let ssTot = 0;
  const residualSeries = [];

  pairs.forEach((point) => {
    const predicted = slope * point.assetB + intercept;
    const residual = point.assetA - predicted;
    residualSeries.push({
      timestamp: point.timestamp,
      residual,
    });
    ssRes += residual * residual;
    const diff = point.assetA - meanY;
    ssTot += diff * diff;
  });

  const rSquared = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return {
    slope,
    intercept,
    rSquared,
    residualSeries,
  };
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSymbol(input) {
  const normalized = input.trim().toUpperCase();
  if (!normalized) {
    throw new Error("Asset symbol cannot be empty.");
  }
  const cleaned = normalized.replace(/[^A-Z0-9]/g, "");
  if (!cleaned) {
    throw new Error("Asset symbol must contain alphanumeric characters.");
  }
  if (cleaned.startsWith("T") && cleaned.length > 1) {
    return cleaned;
  }
  if (cleaned.length <= 4) {
    return `t${cleaned}USD`;
  }
  return `t${cleaned}`;
}

function deriveDisplayName(input) {
  const normalized = input.trim().toUpperCase();
  if (!normalized) {
    return "";
  }
  const cleaned = normalized.replace(/[^A-Z0-9]/g, "");
  if (!cleaned) {
    return "";
  }
  let name = cleaned;
  if (name.startsWith("T") && name.length > 1) {
    name = name.slice(1);
  }
  if (name.endsWith("USD")) {
    name = name.slice(0, -3);
  }
  return name || cleaned;
}

function normalizeResolution(input) {
  const value = (input || "").trim();
  if (!value) {
    return "1h";
  }
  const key = value.toLowerCase();
  const resolution = SUPPORTED_RESOLUTIONS.get(key);
  if (!resolution) {
    throw new Error(`Resolution ${value} is not supported.`);
  }
  return resolution;
}

function sanitizeLimit(input) {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("Observation count must be a positive number.");
  }
  return Math.max(10, Math.min(parsed, 1000));
}

function destroyChart(chartKey) {
  if (charts[chartKey]) {
    charts[chartKey].destroy();
    charts[chartKey] = null;
  }
}

function resetChartsAndStats() {
  destroyChart("combinedHistory");
  destroyChart("regression");
  destroyChart("residuals");
  updateRegressionStats(null);
}


function renderCombinedHistoryChart(labels, assetAPrices, assetBPrices, labelA, labelB) {
  destroyChart("combinedHistory");
  const ctx = document.getElementById("combined-history-chart");
  charts.combinedHistory = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: `${labelA} Price`,
          data: assetAPrices,
          borderColor: "#22d3ee",
          backgroundColor: "rgba(34, 211, 238, 0.2)",
          yAxisID: "yA",
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: `${labelB} Price`,
          data: assetBPrices,
          borderColor: "#facc15",
          backgroundColor: "rgba(250, 204, 21, 0.2)",
          yAxisID: "yB",
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          grid: {
            color: "rgba(148, 163, 184, 0.1)",
          },
        },
        yA: {
          position: "left",
          ticks: {
            callback: (value) => Number(value).toFixed(0),
          },
          grid: {
            color: "rgba(14, 116, 144, 0.15)",
          },
        },
        yB: {
          position: "right",
          ticks: {
            callback: (value) => Number(value).toFixed(0),
          },
          grid: {
            drawOnChartArea: false,
          },
        },
      },
      plugins: {
        legend: {
          display: true,
        },
      },
    },
  });
}
function renderLineChart(chartKey, canvasId, labels, datasetLabel, data, color) {
  destroyChart(chartKey);
  const context = document.getElementById(canvasId);
  charts[chartKey] = new Chart(context, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: datasetLabel,
          data,
          borderColor: color,
          backgroundColor: color,
          tension: 0.2,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          ticks: {
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          grid: {
            color: "rgba(148, 163, 184, 0.1)",
          },
        },
        y: {
          ticks: {
            callback: (value) => Number(value).toFixed(0),
          },
          grid: {
            color: "rgba(148, 163, 184, 0.1)",
          },
        },
      },
      plugins: {
        legend: {
          display: true,
        },
      },
    },
  });
}

function renderRegressionChart(pairs, regression, assetADisplay, assetBDisplay) {
  destroyChart("regression");
  const context = document.getElementById("regression-chart");
  const scatterData = pairs.map((point) => ({
    x: point.assetB,
    y: point.assetA,
  }));
  const assetBValues = pairs.map((point) => point.assetB);
  const minX = Math.min(...assetBValues);
  const maxX = Math.max(...assetBValues);
  const lineData = [
    { x: minX, y: regression.slope * minX + regression.intercept },
    { x: maxX, y: regression.slope * maxX + regression.intercept },
  ];

  const xLabel = assetBDisplay || "Asset B";
  const yLabel = assetADisplay || "Asset A";

  charts.regression = new Chart(context, {
    type: "scatter",
    data: {
      datasets: [
        {
          label: `${yLabel} vs ${xLabel}`,
          data: scatterData,
          backgroundColor: "rgba(236, 72, 153, 0.65)",
        },
        {
          label: "Regression",
          data: lineData,
          type: "line",
          borderColor: "#22d3ee",
          backgroundColor: "#22d3ee",
          borderWidth: 2,
          pointRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          title: {
            display: true,
            text: `${xLabel} Price`,
          },
          grid: {
            color: "rgba(148, 163, 184, 0.08)",
          },
        },
        y: {
          title: {
            display: true,
            text: `${yLabel} Price`,
          },
          grid: {
            color: "rgba(148, 163, 184, 0.08)",
          },
        },
      },
      plugins: {
        legend: {
          display: true,
        },
      },
    },
  });
}

function updateRegressionStats(regression) {
  const slopeEl = document.getElementById("slope-value");
  const interceptEl = document.getElementById("intercept-value");
  const r2El = document.getElementById("r2-value");

  slopeEl.textContent = regression ? regression.slope.toFixed(4) : "-";
  interceptEl.textContent = regression ? regression.intercept.toFixed(2) : "-";
  r2El.textContent = regression ? regression.rSquared.toFixed(4) : "-";
}

function setStatus(message, isError = false) {
  const statusEl = document.getElementById("status-text");
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function updateHeadings(assetADisplay, assetBDisplay) {
  const combinedHeading = document.getElementById("combined-history-heading");
  const regressionHeading = document.getElementById("regression-heading");
  const residualHeading = document.getElementById("residual-heading");
  const assetALabel = document.getElementById("asset-a-label");
  const assetBLabel = document.getElementById("asset-b-label");

  const displayA = assetADisplay || "Asset A";
  const displayB = assetBDisplay || "Asset B";

  combinedHeading.textContent = `${displayA} & ${displayB} Price History`;
  regressionHeading.textContent = `${displayA} vs ${displayB} Regression`;
  residualHeading.textContent = `${displayA} Residuals Over Time`;
  assetALabel.textContent = displayA;
  assetBLabel.textContent = displayB;
}

async function loadAndRender(event) {
  if (event) {
    event.preventDefault();
  }

  const refreshButton = document.getElementById("refresh-button");
  const assetAInput = document.getElementById("asset-a-input");
  const assetBInput = document.getElementById("asset-b-input");
  const resolutionSelect = document.getElementById("resolution-select");
  const limitInput = document.getElementById("limit-input");

  try {
    refreshButton.disabled = true;
    refreshButton.textContent = "Loading...";

    const rawAssetA = assetAInput.value;
    const rawAssetB = assetBInput.value;
    if (!rawAssetA.trim() || !rawAssetB.trim()) {
      throw new Error("Both asset inputs are required.");
    }

    const resolution = normalizeResolution(resolutionSelect.value);
    const limit = sanitizeLimit(limitInput.value);

    const assetADisplay = deriveDisplayName(rawAssetA);
    const assetBDisplay = deriveDisplayName(rawAssetB);
    updateHeadings(assetADisplay, assetBDisplay);

    const symbolA = buildSymbol(rawAssetA);
    const symbolB = buildSymbol(rawAssetB);

    setStatus(
      `Fetching latest data for ${symbolA} and ${symbolB} (${resolution}, limit ${limit})...`
    );

    const [assetASeries, assetBSeries] = await Promise.all([
      fetchCandleHistory(symbolA, resolution, limit),
      fetchCandleHistory(symbolB, resolution, limit),
    ]);

    const merged = mergeSeries(assetASeries, assetBSeries);
    if (!merged.length) {
      throw new Error("No overlapping data points between the selected assets.");
    }

    const regression = computeRegression(merged);
    if (!regression) {
      throw new Error("Unable to compute regression with the selected data.");
    }

    const labels = merged.map((point) => formatTimestamp(point.timestamp));
    const assetAPrices = merged.map((point) => point.assetA);
    const assetBPrices = merged.map((point) => point.assetB);
    const residualValues = regression.residualSeries.map((item) => item.residual);

    const dataLabelA = assetADisplay || symbolA;
    const dataLabelB = assetBDisplay || symbolB;

    renderCombinedHistoryChart(labels, assetAPrices, assetBPrices, dataLabelA, dataLabelB);
    renderLineChart(
      "residuals",
      "residual-chart",
      labels,
      `Residual (${dataLabelA} - predicted)`,
      residualValues,
      "#f97316"
    );
    renderRegressionChart(merged, regression, dataLabelA, dataLabelB);
    updateRegressionStats(regression);

    const updatedTime = new Date().toLocaleTimeString();
    setStatus(
      `Last updated at ${updatedTime} for ${dataLabelA}/${dataLabelB} (${resolution}, limit ${limit})`
    );
  } catch (error) {
    console.error(error);
    resetChartsAndStats();
    setStatus(`Failed to load data: ${error.message}`, true);
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = "Load Data";
  }
}

function handleParameterChange() {
  resetChartsAndStats();
  setStatus("Parameters changed. Click Load Data to refresh.");
}

function registerEvents() {
  const form = document.getElementById("control-form");
  form.addEventListener("submit", loadAndRender);

  const assetAInput = document.getElementById("asset-a-input");
  const assetBInput = document.getElementById("asset-b-input");
  const limitInput = document.getElementById("limit-input");
  const resolutionSelect = document.getElementById("resolution-select");

  [assetAInput, assetBInput, limitInput].forEach((element) => {
    if (element) {
      element.addEventListener("input", handleParameterChange);
    }
  });

  if (resolutionSelect) {
    resolutionSelect.addEventListener("change", handleParameterChange);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  registerEvents();
  loadAndRender();
});
