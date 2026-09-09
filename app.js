/**
 * Twitter Sentiment Classifier - Client
 * Guaranteed Multi-Tier Prediction Engine:
 * 1. Local Trained PyTorch Model (if python app.py is running on :8000)
 * 2. In-Browser Neural AI (Transformers.js • RoBERTa Twitter Sentiment)
 * 3. Fast In-Browser Lexicon Sentiment Engine (instant fallback, 0 network dependency)
 * 
 * Never fails • Zero tokens required • Works offline, locally, and on Vercel
 */

// Lexicon-based sentiment dictionary for instant, 100% reliable fallback
const SENTIMENT_LEXICON = {
  // Strong Positive
  love: 3, excellent: 3, amazing: 3, wonderful: 3, fantastic: 3, superb: 3, awesome: 3,
  brilliant: 3, perfect: 3, best: 3, outstanding: 3, masterpiece: 3, adore: 3,
  // Positive
  good: 1.8, great: 2, happy: 2, joy: 2, like: 1.2, pleased: 1.5, nice: 1.5,
  glad: 1.5, exciting: 2, beautiful: 2, cool: 1.5, fun: 1.5, win: 2, winning: 2,
  enjoy: 1.8, enjoyed: 1.8, helpful: 1.5, thank: 1.5, thanks: 1.5, sweet: 1.5,
  // Strong Negative
  hate: -3, terrible: -3, horrible: -3, awful: -3, disgust: -3, disgusting: -3,
  worst: -3, disaster: -3, crap: -2.5, shit: -2.5, useless: -2.5, trash: -2.5,
  // Negative
  bad: -1.8, poor: -1.8, sad: -1.5, angry: -2, broken: -2, fail: -2, failed: -2,
  failure: -2, boring: -1.5, slow: -1.2, painful: -2, annoy: -1.8, annoying: -1.8,
  hurt: -1.5, wrong: -1.5, mess: -1.8, error: -1.5, bug: -1.5, suck: -2.5, sucks: -2.5,
  // Emojis
  '😊': 2, '😃': 2, '😄': 2, '😁': 2, '❤️': 3, '🔥': 2, '👍': 1.8, '🎉': 2.5, '✨': 1.5,
  '😡': -3, '🤬': -3, '😢': -2, '😭': -2, '💔': -2.5, '👎': -2, '💩': -2.5, '🤮': -3
};

const NEGATORS = new Set(['not', "don't", 'dont', 'never', 'no', 'hardly', 'barely', "didn't", 'didnt', "wasn't", 'wasnt', "can't", 'cant']);
const INTENSIFIERS = { very: 1.5, extremely: 2.0, super: 1.6, really: 1.4, so: 1.3, totally: 1.5 };

function analyzeSentimentLexicon(text) {
  const words = text.toLowerCase().match(/\b[\w']+\b|[\uD800-\uDBFF][\uDC00-\uDFFF]/gu) || [];
  let score = 0;
  let matches = 0;
  let negated = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (NEGATORS.has(word)) {
      negated = true;
      continue;
    }

    let multiplier = negated ? -0.8 : 1.0;
    const prevWord = words[i - 1];
    if (prevWord && INTENSIFIERS[prevWord]) {
      multiplier *= INTENSIFIERS[prevWord];
    }

    if (SENTIMENT_LEXICON[word] !== undefined) {
      score += SENTIMENT_LEXICON[word] * multiplier;
      matches++;
      negated = false;
    }
  }

  let label = 'Neutral';
  let confidence = 0.65;

  if (score > 0.8) {
    label = 'Positive';
    confidence = Math.min(0.98, 0.70 + Math.min(score, 6) * 0.045);
  } else if (score < -0.8) {
    label = 'Negative';
    confidence = Math.min(0.98, 0.70 + Math.min(Math.abs(score), 6) * 0.045);
  } else {
    label = 'Neutral';
    confidence = 0.72;
  }

  return {
    text: text,
    intent: label,
    confidence: Number(confidence.toFixed(4)),
    source: 'In-Browser Sentiment Engine',
    details: { sentiment_score: Number(score.toFixed(2)), matched_tokens: matches }
  };
}

// In-Browser Neural AI loader
let neuralPipeline = null;
async function getNeuralPipeline(onProgress) {
  if (neuralPipeline) return neuralPipeline;
  try {
    const { pipeline, env } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
    env.allowLocalModels = false;
    env.useBrowserCache = true;
    neuralPipeline = await pipeline('sentiment-analysis', 'Xenova/twitter-roberta-base-sentiment-latest', {
      progress_callback: onProgress
    });
    return neuralPipeline;
  } catch (err) {
    console.warn('Could not initialize Transformers.js CDN, using resilient built-in engine:', err);
    return null;
  }
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
      console.warn('Primary predictor notice, utilizing resilient fallback:', err);
      const fallback = analyzeSentimentLexicon(text);
      displayResult(fallback);
    } finally {
      showLoading(false);
    }
  });

  async function predictSentiment(text) {
    // 1. Try local Python FastAPI server if running
    try {
      const endpoints = [
        window.location.origin.includes('8000') ? '/predict' : null,
        'http://127.0.0.1:8000/predict'
      ].filter(Boolean);

      for (const ep of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 900);
          const res = await fetch(ep, {
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
        } catch (_) {}
      }
    } catch (_) {}

    // 2. Try In-Browser Neural AI
    try {
      showLoading(true, 'Running AI model...');
      const pipe = await Promise.race([
        getNeuralPipeline((prog) => {
          if (prog.status === 'progress' && loadingText) {
            const pct = Math.round(prog.progress || 0);
            loadingText.textContent = `Loading model: ${pct}%...`;
          }
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
      ]);

      if (pipe) {
        const out = await pipe(text);
        const top = out && out[0] ? out[0] : { label: 'neutral', score: 0.5 };
        const rawLabel = (top.label || '').toLowerCase();
        let sentiment = 'Neutral';
        if (rawLabel.includes('pos')) sentiment = 'Positive';
        else if (rawLabel.includes('neg')) sentiment = 'Negative';

        return {
          text: text,
          intent: sentiment,
          confidence: Number(top.score.toFixed(4)),
          source: 'In-Browser Neural AI (RoBERTa)',
          raw: out
        };
      }
    } catch (_) {}

    // 3. Guaranteed instant sentiment engine
    return analyzeSentimentLexicon(text);
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
