/**
 * Vercel Serverless Function - AI Proxy API
 * Routes requests to Google Generative AI (Gemini) securely using environment variables.
 */

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  const geminiApiKey = process.env.GEMINI_API_KEY;
  if (!geminiApiKey) {
    return res.status(500).json({
      success: false,
      message: 'GEMINI_API_KEY environment variable is missing on server.'
    });
  }

  const { context: taskContext, text, additionalData = {} } = req.body || {};

  try {
    if (taskContext === 'tts') {
      // Audio generation using Gemini 2.5 Flash TTS
      const modelName = 'gemini-2.5-flash-preview-tts';
      const ttsPayload = {
        contents: [
          {
            parts: [{ text: text || 'Hello' }]
          }
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Puck' }
            }
          }
        }
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ttsPayload)
        }
      );

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error.message || 'TTS generation failed');
      }

      const audioData = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
      if (!audioData) {
        throw new Error('No audio content returned by Gemini TTS.');
      }

      return res.status(200).json({ success: true, response: audioData });
    } else if (taskContext === 'chat') {
      // Interactive multi-turn chat
      const modelName = 'gemini-3.5-flash';
      const contents = (additionalData.chatHistory || []).map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.parts?.[0]?.text || '' }]
      }));

      if (text) {
        contents.push({ role: 'user', parts: [{ text }] });
      }

      const chatPayload = {
        system_instruction: {
          parts: [
            {
              text: `You are an expert career mentor. Recommended careers: ${additionalData.careerContext || 'N/A'}.`
            }
          ]
        },
        contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }]
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chatPayload)
        }
      );

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error.message || 'Chat generation failed');
      }

      const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.status(200).json({ success: true, response: responseText });
    } else {
      // All other single-shot prompts (summary, recommendations, interview questions, cover letter, learning plan, etc.)
      const modelName = 'gemini-3.5-flash';
      const payload = {
        contents: [
          {
            parts: [{ text: text || 'Hello' }]
          }
        ]
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }
      );

      const result = await response.json();
      if (result.error) {
        throw new Error(result.error.message || 'AI request failed');
      }

      const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return res.status(200).json({ success: true, response: responseText });
    }
  } catch (error) {
    console.error('Vercel API Proxy Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal Server Error'
    });
  }
};

