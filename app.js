/**
 * Twitter Sentiment Classifier - Client
 * Connects to YOUR custom-trained model on Hugging Face (or local FastAPI app.py)
 */

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('sentimentForm');
  const tweetInput = document.getElementById('tweetInput');
  const charCount = document.getElementById('charCount');
  const clearBtn = document.getElementById('clearBtn');
  const apiUrlInput = document.getElementById('apiUrl');
  const submitBtn = document.getElementById('submitBtn');

  const loadingIndicator = document.getElementById('loadingIndicator');
  const errorBox = document.getElementById('errorBox');
  const resultsCard = document.getElementById('resultsCard');
  const sentimentBadge = document.getElementById('sentimentBadge');
  const confidenceScore = document.getElementById('confidenceScore');
  const rawResponse = document.getElementById('rawResponse');

  const DEFAULT_HF_ENDPOINT = 'https://api-inference.huggingface.co/models/Soulity/tweet-sentiment-classifier-model';
  // Use /api/predict by default when hosted on Vercel/web server; otherwise fallback to HF endpoint
  const DEFAULT_ENDPOINT = window.location.protocol.startsWith('http')
    ? '/api/predict'
    : DEFAULT_HF_ENDPOINT;

  // Map raw model IDs to your 4 trained classes
  const LABEL_MAP = {
    'LABEL_0': 'Irrelevant',
    'LABEL_1': 'Negative',
    'LABEL_2': 'Neutral',
    'LABEL_3': 'Positive'
  };

  // Preset buttons (Local FastAPI, Hugging Face, Vercel)
  const presetBtns = document.querySelectorAll('.preset-btn');
  presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      presetBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      apiUrlInput.value = btn.dataset.url;
    });
  });

  apiUrlInput.addEventListener('input', () => {
    const val = apiUrlInput.value.trim();
    presetBtns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.url === val);
    });
  });

  // Character counter
  tweetInput.addEventListener('input', () => {
    const len = tweetInput.value.length;
    charCount.textContent = `${len} / 280`;
  });

  // Clear button
  clearBtn.addEventListener('click', () => {
    tweetInput.value = '';
    charCount.textContent = '0 / 280';
    hideResults();
    hideError();
    tweetInput.focus();
  });

  // Form submit -> Send tweet to model
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = tweetInput.value.trim();
    if (!text) return;

    const endpoint = apiUrlInput.value.trim() || 'http://127.0.0.1:8000/predict';
    const isHuggingFace = endpoint.includes('huggingface.co');
    const isLocalFastAPI = endpoint.includes('8000') || endpoint.includes('127.0.0.1') || endpoint.includes('localhost');
    const isVercelProxy = endpoint.includes('/api/predict') || endpoint === '/predict';

    hideError();
    hideResults();

    let loadingMsg = 'Running inference...';
    if (isLocalFastAPI) loadingMsg = '⚡ Inferring with local FastAPI model...';
    else if (isVercelProxy) loadingMsg = '▲ Analyzing sentiment via Vercel proxy...';
    else if (isHuggingFace) loadingMsg = '🤗 Calling model on Hugging Face...';

    showLoading(true, loadingMsg);

    try {
      // Send both 'text' and 'inputs' so it works interchangeably across HF, local FastAPI, and Vercel proxy
      const requestBody = isHuggingFace 
        ? { inputs: text } 
        : { text: text, inputs: text };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503 && data.estimated_time) {
          throw new Error(`Model is warming up on Hugging Face (estimated wait: ${Math.round(data.estimated_time)}s). Please wait a moment and click Analyze again!`);
        }
        throw new Error(data.error || data.detail || response.statusText);
      }

      // Handle response formats
      let sentiment = 'Unknown';
      let confidence = 0;

      if (Array.isArray(data)) {
        // Hugging Face format: [[ { label: "LABEL_3", score: 0.98 }, ... ]]
        const list = Array.isArray(data[0]) ? data[0] : data;
        const top = list[0] || {};
        const rawLabel = top.label || 'Unknown';
        sentiment = LABEL_MAP[rawLabel] || rawLabel;
        confidence = top.score || 0;
      } else if (data.intent || data.sentiment) {
        // Local FastAPI format: { text: "...", intent: "Positive", confidence: 0.98 }
        sentiment = data.intent || data.sentiment;
        confidence = data.confidence || 0;
      }

      displayResult({
        text: text,
        intent: sentiment,
        confidence: confidence,
        raw: data
      });

    } catch (err) {
      if (isLocalFastAPI && (err.message.includes('Failed to fetch') || err.name === 'TypeError')) {
        showError(`⚠️ <strong>FastAPI Connection Error:</strong> Unable to reach <code>${endpoint}</code>.<br><br>Make sure your FastAPI server is running in your terminal:<br><code style="background:#161b22;padding:4px 8px;border-radius:4px;display:inline-block;margin-top:6px;font-family:monospace;">python app.py</code>`);
      } else {
        showError(`Inference notice: ${err.message}`);
      }
    } finally {
      showLoading(false);
    }
  });

  function showLoading(isLoading, msg = 'Running inference...') {
    loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    const span = loadingIndicator.querySelector('span');
    if (span) span.textContent = msg;
    submitBtn.disabled = isLoading;
  }

  function showError(msg) {
    errorBox.innerHTML = msg;
    errorBox.style.display = 'block';
  }

  function hideError() {
    errorBox.style.display = 'none';
    errorBox.innerHTML = '';
  }

  function hideResults() {
    resultsCard.style.display = 'none';
  }

  function displayResult(result) {
    const sentiment = result.intent;
    const confidence = typeof result.confidence === 'number' 
      ? (result.confidence * 100).toFixed(1) + '%' 
      : result.confidence;

    sentimentBadge.textContent = sentiment;
    sentimentBadge.className = 'result-badge';

    const sLower = sentiment.toLowerCase();
    if (sLower.includes('pos')) {
      sentimentBadge.classList.add('badge-positive');
    } else if (sLower.includes('neg')) {
      sentimentBadge.classList.add('badge-negative');
    } else if (sLower.includes('neu')) {
      sentimentBadge.classList.add('badge-neutral');
    } else {
      sentimentBadge.classList.add('badge-irrelevant');
    }

    confidenceScore.textContent = confidence;
    rawResponse.textContent = JSON.stringify(result.raw || result, null, 2);
    resultsCard.style.display = 'block';
  }
});
