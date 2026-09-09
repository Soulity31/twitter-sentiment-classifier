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

  const hfTokenInput = document.getElementById('hfToken');

  // Load saved token from browser storage
  const savedToken = localStorage.getItem('hf_access_token');
  if (savedToken && hfTokenInput) {
    hfTokenInput.value = savedToken;
  } else if (hfTokenInput && hfTokenInput.value) {
    localStorage.setItem('hf_access_token', hfTokenInput.value.trim());
  }
  if (hfTokenInput) {
    hfTokenInput.addEventListener('input', () => {
      localStorage.setItem('hf_access_token', hfTokenInput.value.trim());
    });
  }

  // Active Hugging Face Router Endpoint
  const DEFAULT_HF_ENDPOINT = 'https://router.huggingface.co/hf-inference/models/Soulity/tweet-sentiment-classifier-model';

  // Map raw model IDs to your 4 trained classes
  const LABEL_MAP = {
    'LABEL_0': 'Irrelevant',
    'LABEL_1': 'Negative',
    'LABEL_2': 'Neutral',
    'LABEL_3': 'Positive'
  };

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

    // Use input endpoint or default to Hugging Face
    const endpoint = apiUrlInput.value.trim() || DEFAULT_HF_ENDPOINT;
    const isHuggingFace = endpoint.includes('huggingface.co');
    const isVercelProxy = endpoint.startsWith('/api/') || endpoint.startsWith('/predict');
    const token = hfTokenInput ? hfTokenInput.value.trim() : '';

    hideError();
    hideResults();

    // Check if calling HF directly without a token
    if (isHuggingFace && !token) {
      showError(
        `⚠️ <strong>Hugging Face Token Required:</strong><br>` +
        `Hugging Face blocks anonymous browser requests with <code>Failed to fetch</code> (CORS 401).<br><br>` +
        `Please paste your free Hugging Face token in the <strong>Access Token</strong> field above (starts with <code>hf_...</code>) or deploy to Vercel.`
      );
      if (hfTokenInput) hfTokenInput.focus();
      return;
    }

    showLoading(true, isVercelProxy ? 'Analyzing via Vercel proxy...' : 'Calling your Hugging Face model...');

    try {
      const headers = {
        'Content-Type': 'application/json'
      };

      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ inputs: text })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 503 && data.estimated_time) {
          throw new Error(`Model is warming up on Hugging Face (estimated wait: ${Math.round(data.estimated_time)}s). Please wait a moment and click Analyze again!`);
        }
        if (response.status === 401) {
          throw new Error(`Invalid or unauthorized Hugging Face token. Please check your token at huggingface.co/settings/tokens`);
        }
        throw new Error(data.error || data.detail || `Hugging Face returned status ${response.status}`);
      }

      // Handle Hugging Face array format: [[ { label: "LABEL_3", score: 0.98 }, ... ]]
      let sentiment = 'Unknown';
      let confidence = 0;

      if (Array.isArray(data)) {
        const list = Array.isArray(data[0]) ? data[0] : data;
        const top = list[0] || {};
        const rawLabel = top.label || 'Unknown';
        sentiment = LABEL_MAP[rawLabel] || rawLabel;
        confidence = top.score || 0;
      } else if (data.intent || data.sentiment) {
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
      if (err.message.includes('Failed to fetch') || err.name === 'TypeError') {
        showError(
          `⚠️ <strong>Connection Error (Failed to fetch):</strong><br>` +
          `Your browser was blocked by CORS when communicating directly with Hugging Face.<br><br>` +
          `<strong>How to fix:</strong><br>` +
          `1. Ensure your Hugging Face token is filled in above.<br>` +
          `2. Or deploy to Vercel (where <code>/api/predict</code> bypasses browser CORS entirely).`
        );
      } else {
        showError(`Hugging Face Notice: ${err.message}`);
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
