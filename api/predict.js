export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};
    const text = body.text || body.inputs;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Text cannot be empty' });
    }

    const MODEL_ID = 'Soulity/tweet-sentiment-classifier-model';
    const primaryUrl = `https://api-inference.huggingface.co/models/${MODEL_ID}`;
    const routerUrl = `https://router.huggingface.co/hf-inference/models/${MODEL_ID}`;

    // Use token from Vercel Environment Variables or incoming header
    const token =
      process.env.HF_TOKEN ||
      process.env.HUGGINGFACE_TOKEN ||
      (req.headers['authorization'] ? req.headers['authorization'].replace('Bearer ', '') : null);

    const headers = {
      'Content-Type': 'application/json'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    let response = await fetch(primaryUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputs: text })
    });

    // Fallback to router endpoint if 404
    if (response.status === 404) {
      response = await fetch(routerUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ inputs: text })
      });
    }

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 503 && data.estimated_time) {
        return res.status(503).json({
          error: `Model is warming up on Hugging Face (estimated wait: ${Math.round(data.estimated_time)}s). Please try again shortly!`
        });
      }
      return res.status(response.status).json({
        error: data.error || data.detail || `Hugging Face API returned error ${response.status}`
      });
    }

    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Server error communicating with Hugging Face Inference API'
    });
  }
}
