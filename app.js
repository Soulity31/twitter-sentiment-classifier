/**
 * Twitter Sentiment Classifier - Frontend Client
 * Simple fetch integration ready to connect to your FastAPI backend.
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

  // Form submit -> Send to FastAPI
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = tweetInput.value.trim();
    if (!text) return;

    const endpoint = apiUrlInput.value.trim() || 'http://127.0.0.1:8000/predict';

    hideError();
    hideResults();
    showLoading(true);

    try {
      // POST request to your FastAPI backend
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      displayResult(data);

    } catch (err) {
      showError(`Could not connect to FastAPI at ${endpoint}.<br><small>Details: ${err.message}. Make sure your FastAPI server is running with CORS enabled.</small>`);
    } finally {
      showLoading(false);
    }
  });

  function showLoading(isLoading) {
    loadingIndicator.style.display = isLoading ? 'flex' : 'none';
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

  function displayResult(data) {
    // Look for common sentiment keys (e.g. sentiment, label, prediction, or result)
    const sentiment = (data.intent || data.sentiment || data.label || data.prediction || 'Unknown').toString();
    const confidence = data.confidence !== undefined ? (typeof data.confidence === 'number' ? (data.confidence * 100).toFixed(1) + '%' : data.confidence) : 'N/A';

    sentimentBadge.textContent = sentiment;
    sentimentBadge.className = 'result-badge';

    const sLower = sentiment.toLowerCase();
    if (sLower.includes('pos')) {
      sentimentBadge.classList.add('badge-positive');
    } else if (sLower.includes('neg')) {
      sentimentBadge.classList.add('badge-negative');
    } else {
      sentimentBadge.classList.add('badge-neutral');
    }

    confidenceScore.textContent = confidence;
    rawResponse.textContent = JSON.stringify(data, null, 2);
    resultsCard.style.display = 'block';
  }
});
