/**
 * Cloudflare Worker with Static Assets
 * Handles /api/proxy requests and serves static assets from ./public
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API Route for Gemini Proxy
    if (url.pathname === '/api/proxy') {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          },
        });
      }

      if (request.method === 'POST') {
        const corsHeaders = {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        };

        const geminiApiKey = env.GEMINI_API_KEY;
        if (!geminiApiKey) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'GEMINI_API_KEY is missing. Please set it in Cloudflare Settings > Variables and Secrets.',
            }),
            { status: 500, headers: corsHeaders }
          );
        }

        try {
          const body = await request.json();
          const { context: taskContext, text, additionalData = {} } = body || {};

          if (taskContext === 'tts') {
            // Voice TTS
            const modelName = 'gemini-2.5-flash-preview-tts';
            const ttsPayload = {
              contents: [{ parts: [{ text: text || 'Hello' }] }],
              generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                  voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
                },
              },
            };

            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(ttsPayload),
              }
            );

            const result = await response.json();
            if (result.error) throw new Error(result.error.message || 'TTS generation failed');

            const audioData = result?.candidates?.[0]?.content?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (!audioData) throw new Error('No audio returned by Gemini TTS.');

            return new Response(JSON.stringify({ success: true, response: audioData }), {
              status: 200,
              headers: corsHeaders,
            });

          } else if (taskContext === 'chat') {
            // Multi-turn AI Mentor Chat
            const modelName = 'gemini-3.5-flash';
            const contents = (additionalData.chatHistory || []).map(m => ({
              role: m.role === 'model' ? 'model' : 'user',
              parts: [{ text: m.parts?.[0]?.text || '' }],
            }));

            if (text) contents.push({ role: 'user', parts: [{ text }] });

            const chatPayload = {
              system_instruction: {
                parts: [{ text: `You are an expert career mentor for college students. Recommended careers: ${additionalData.careerContext || 'N/A'}.` }],
              },
              contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Hello' }] }],
            };

            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chatPayload),
              }
            );

            const result = await response.json();
            if (result.error) throw new Error(result.error.message || 'Chat generation failed');

            const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return new Response(JSON.stringify({ success: true, response: responseText }), {
              status: 200,
              headers: corsHeaders,
            });

          } else {
            // General Assessment, Fit Score, Learning Plan, Networking Plan, Cover Letter
            const modelName = 'gemini-3.5-flash';
            const payload = {
              contents: [{ parts: [{ text: text || 'Hello' }] }],
            };

            const response = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              }
            );

            const result = await response.json();
            if (result.error) throw new Error(result.error.message || 'AI request failed');

            const responseText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return new Response(JSON.stringify({ success: true, response: responseText }), {
              status: 200,
              headers: corsHeaders,
            });
          }

        } catch (error) {
          return new Response(
            JSON.stringify({ success: false, message: error.message || 'Internal Server Error' }),
            { status: 500, headers: corsHeaders }
          );
        }
      }
    }

    // Serve Static Assets from ./public (HTML, JS, CSS)
    if (env.ASSETS) {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
