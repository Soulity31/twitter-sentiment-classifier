/**
 * Twitter Sentiment Classifier - Client
 * Supports both:
 * 1. Local Python FastAPI backend (http://127.0.0.1:8000) using your trained model.safetensors
 * 2. In-browser AI (Transformers.js) for 100% serverless deployment on Vercel or Live Server
 * Zero tokens required • Zero cloud API rate limits • Zero deployment headaches
 */

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Enable browser cache for instant repeat predictions
env.allowLocalModels = false;
env.useBrowserCache = true;

let browserClassifier = null;

async function getBrowserClassifier(onProgress) {
  if (!browserClassifier) {
    browserClassifier = await pipeline('sentiment-analysis', 'Xenova/twitter-roberta-base-sentiment-latest', {
      progress_callback: onProgress
    });
  }
  return browserClassifier;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('sentimentForm');
  const tweetInput = document.getElementById('tweetInput');
  const charCount = document.getElementById('charCount');
  const clearBtn = document.getElementById('clearBtn');
  const submitBtn = document.getElementById('submitBtn');

  const loadingIndicator = document.getElementById('loadingIndicator');
  const loadingText = document.getElementById('loadingText');
  const errorBox = document.getElementById('errorBox');
  const resultsCard = document.getElementById('resultsCard');
  const sentimentBadge = document.getElementById('sentimentBadge');
  const confidenceScore = document.getElementById('confidenceScore');
  const rawResponse = document.getElementById('rawResponse');

  // Live character counter
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

  // Form submit -> Run sentiment classification
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = tweetInput.value.trim();
    if (!text) return;

    hideError();
    hideResults();
    showLoading(true, 'Analyzing sentiment...');

    try {
      const result = await predictSentiment(text);
      displayResult(result);
    } catch (err) {
      console.error('Classification error:', err);
      showError(`Analysis notice: ${err.message || 'Unable to classify tweet'}`);
    } finally {
      showLoading(false);
    }
  });

  /**
   * Dual-engine sentiment predictor:
   * 1. Checks if local FastAPI app.py is running on port 8000
   * 2. Automatically falls back to in-browser Transformers.js (zero server needed)
   */
  async function predictSentiment(text) {
    // 1. Try local Python FastAPI server if running
    try {
      const localEndpoints = [
        window.location.origin.includes('8000') ? '/predict' : null,
        'http://127.0.0.1:8000/predict'
      ].filter(Boolean);

      for (const endpoint of localEndpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 1200);

          const res = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            return {
              text: data.text || text,
              intent: data.intent || data.sentiment || 'Unknown',
              confidence: data.confidence,
              source: 'Local Trained PyTorch Model (app.py)',
              raw: data
            };
          }
        } catch (_) {
          // Local backend not reachable on this endpoint, try fallback
        }
      }
    } catch (_) {
      // Continue to in-browser AI
    }

    // 2. In-Browser AI Engine (Transformers.js)
    showLoading(true, 'Initializing in-browser AI model (cached after first run)...');

    const pipe = await getBrowserClassifier((progress) => {
      if (progress.status === 'progress' && loadingText) {
        const pct = Math.round(progress.progress || 0);
        loadingText.textContent = `Loading model weights: ${pct}%...`;
      } else if (progress.status === 'ready' && loadingText) {
        loadingText.textContent = 'Model ready! Analyzing sentiment...';
      }
    });

    showLoading(true, 'Analyzing tweet sentiment...');
    const outputs = await pipe(text);

    // Parse model output
    const top = outputs && outputs[0] ? outputs[0] : { label: 'neutral', score: 0.5 };
    const rawLabel = (top.label || '').toLowerCase();

    let sentiment = 'Neutral';
    if (rawLabel.includes('pos')) sentiment = 'Positive';
    else if (rawLabel.includes('neg')) sentiment = 'Negative';
    else if (rawLabel.includes('irrel')) sentiment = 'Irrelevant';

    return {
      text: text,
      intent: sentiment,
      confidence: top.score,
      source: 'In-Browser AI (Transformers.js • RoBERTa Twitter Sentiment)',
      raw: outputs
    };
  }

  function showLoading(isLoading, msg = 'Analyzing sentiment...') {
    loadingIndicator.style.display = isLoading ? 'flex' : 'none';
    if (loadingText) loadingText.textContent = msg;
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
    const sentiment = (data.intent || data.sentiment || 'Unknown').toString();
    
    let confidenceStr = 'N/A';
    if (typeof data.confidence === 'number') {
      confidenceStr = `${(data.confidence * 100).toFixed(1)}%`;
    } else if (data.confidence) {
      confidenceStr = data.confidence.toString();
    }

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

    confidenceScore.textContent = confidenceStr;
    rawResponse.textContent = JSON.stringify(data, null, 2);
    resultsCard.style.display = 'block';
  }
});
