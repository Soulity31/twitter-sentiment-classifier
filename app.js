/**
 * Twitter Sentiment Classifier - In-Browser AI via Transformers.js
 * Runs 100% client-side in the browser on Vercel without requiring a backend server.
 */

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// Configure Transformers.js to use browser cache
env.allowLocalModels = false;
env.useBrowserCache = true;

let classifier = null;

async function getClassifier(progressCallback) {
  if (!classifier) {
    classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english', {
      progress_callback: progressCallback
    });
  }
  return classifier;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('sentimentForm');
  const tweetInput = document.getElementById('tweetInput');
  const charCount = document.getElementById('charCount');
  const clearBtn = document.getElementById('clearBtn');
  const apiUrlInput = document.getElementById('apiUrl');
  const submitBtn = document.getElementById('submitBtn');

  const loadingIndicator = document.getElementById('loadingIndicator');
  const loadingText = document.getElementById('loadingText');
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

  // Form submit -> Run sentiment analysis
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = tweetInput.value.trim();
    if (!text) return;

    hideError();
    hideResults();

    const customApi = apiUrlInput ? apiUrlInput.value.trim() : '';

    // If user provided a custom backend URL, send request there
    if (customApi) {
      showLoading(true, 'Connecting to custom API...');
      try {
        const response = await fetch(customApi, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text })
        });

        if (!response.ok) {
          throw new Error(`Server returned HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        displayResult(data);
      } catch (err) {
        showError(`Could not connect to API at <code>${customApi}</code>.<br><small>${err.message}</small>`);
      } finally {
        showLoading(false);
      }
      return;
    }

    // Default: Run in-browser AI with Transformers.js (Zero server required)
    showLoading(true, 'Loading AI model into browser (first time only)...');

    try {
      const pipe = await getClassifier((progress) => {
        if (progress.status === 'progress') {
          const pct = Math.round(progress.progress || 0);
          showLoading(true, `Downloading model weights: ${pct}%...`);
        } else if (progress.status === 'ready') {
          showLoading(true, 'Model ready! Analyzing tweet...');
        }
      });

      showLoading(true, 'Analyzing sentiment...');
      const output = await pipe(text);

      // Transformers.js output format: [{ label: 'POSITIVE', score: 0.9987 }]
      const top = output && output[0] ? output[0] : { label: 'Unknown', score: 0 };
      const formattedLabel = top.label === 'POSITIVE' ? 'Positive' : top.label === 'NEGATIVE' ? 'Negative' : top.label;

      displayResult({
        text: text,
        intent: formattedLabel,
        confidence: top.score
      });

    } catch (err) {
      showError(`In-browser classification error: ${err.message}`);
    } finally {
      showLoading(false);
    }
  });

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
    const sentiment = (data.intent || data.sentiment || data.label || data.prediction || 'Unknown').toString();
    const confidence = data.confidence !== undefined 
      ? (typeof data.confidence === 'number' ? (data.confidence * 100).toFixed(1) + '%' : data.confidence) 
      : 'N/A';

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
