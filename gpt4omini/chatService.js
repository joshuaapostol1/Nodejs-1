const axios = require('axios');

const { Readable } = require('stream');

class ChatClient {

  constructor(defaultOptions = {}) {

    this.defaultOptions = {

      model: defaultOptions.model || 'gpt-4o-mini',

      temperature: defaultOptions.temperature || 1.0,

      presence_penalty: defaultOptions.presence_penalty || 0,

      frequency_penalty: defaultOptions.frequency_penalty || 0,

      top_p: defaultOptions.top_p || 1.0,

      chat_token: defaultOptions.chat_token || 72,

      stream: defaultOptions.stream !== undefined ? defaultOptions.stream : false

    };

  }

  async createChatCompletion({ messages, model, temperature, presence_penalty, frequency_penalty, top_p, chat_token }) {

    const config = {

      model: model || this.defaultOptions.model,

      temperature: temperature !== undefined ? temperature : this.defaultOptions.temperature,

      presence_penalty: presence_penalty !== undefined ? presence_penalty : this.defaultOptions.presence_penalty,

      frequency_penalty: frequency_penalty !== undefined ? frequency_penalty : this.defaultOptions.frequency_penalty,

      top_p: top_p !== undefined ? top_p : this.defaultOptions.top_p,

      chat_token: chat_token || this.defaultOptions.chat_token,

      stream: this.defaultOptions.stream

    };
    

    const userMessage = messages[messages.length - 1].content;
    

    let conversationContext = '';

    messages.forEach(msg => {

      if (msg.role === 'system') {

        conversationContext += `System: ${msg.content}\n`;

      } else if (msg.role === 'user') {

        conversationContext += `User: ${msg.content}\n`;

      } else if (msg.role === 'assistant') {

        conversationContext += `Assistant: ${msg.content}\n`;

      }

    });

    const apiUrl = `https://betadash-api-swordslush-production.up.railway.app/gpt4?ask=${encodeURIComponent(userMessage)}`;

    try {

      const response = await axios.get(apiUrl, {

        headers: {

          'accept': 'application/json',

          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

        },

        timeout: 30000

      });

      const data = response.data;

      if (!data.content) {

        throw new Error('Invalid response format from API');

      }
      

      const formattedResponse = {

        id: `chatcmpl-${Date.now()}`,

        object: 'chat.completion',

        created: Math.floor(Date.now() / 1000),

        model: config.model,

        choices: [{

          message: {

            role: 'assistant',

            content: data.content.trim()

          },

          finish_reason: data.is_end ? 'stop' : 'length'

        }],

        usage: {

          prompt_tokens: 0,

          completion_tokens: 0,

          total_tokens: 0

        }

      };

      return formattedResponse;

    } catch (error) {

      console.error('API Error:', error.response?.data || error.message);

      throw new Error('Failed to get response from GPT4O Mini API');

    }

  }

  createStream(stream) {

    const readable = new Readable({ objectMode: true, read() {} });

    let fullContent = '';

    let metadata = {};

    stream.on('data', chunk => {

      const buffer = chunk.toString();

      const lines = buffer.split('\n');

      lines.forEach(line => {

        if (line.startsWith('data: ')) {

          const data = line.slice(6).trim();

          if (data === '[DONE]') {

            const finalResponse = {

              id: metadata.id,

              object: 'chat.completion',

              created: metadata.created,

              model: metadata.model,

              choices: [{

                message: { role: 'assistant', content: fullContent.replace(/provided by \[?Easy[Cc]h?[at]?t?\]?\([^)]*\)|provided by Easy[Hh]at|>\s*provided by|provided by.*?eqing\.t[ce]h.*?\)|>\s*|\[EasyCht\]\([^)]*\)|\[Easy[Cc]h?[at]?t?\]\([^)]*\)|\[Easyhat\]\([^)]*\)|Easyhat|easyhat/gi, '').trim() },

                finish_reason: 'stop'

              }]

            };

            readable.push(JSON.stringify(finalResponse));

            readable.push(null);

          } else if (data) {

            try {

              const parsed = JSON.parse(data);

              metadata.id = parsed.id || metadata.id;

              metadata.created = parsed.created || metadata.created;

              metadata.model = parsed.model || metadata.model;

              const content = parsed.choices[0]?.delta?.content || '';

              fullContent += content;

              const chunkResponse = {

                id: metadata.id,

                object: 'chat.completion',

                created: metadata.created,

                model: metadata.model,

                choices: [{

                  message: { role: 'assistant', content: fullContent.replace(/provided by \[?Easy[Cc]h?[at]?t?\]?\([^)]*\)|provided by Easy[Hh]at|>\s*provided by|provided by.*?eqing\.t[ce]h.*?\)|>\s*|\[EasyCht\]\([^)]*\)|\[Easy[Cc]h?[at]?t?\]\([^)]*\)|\[Easyhat\]\([^)]*\)|Easyhat|easyhat/gi, '').trim() },

                  finish_reason: parsed.choices[0]?.finish_reason || null

                }]

              };

              readable.push(JSON.stringify(chunkResponse));

            } catch (e) {

            }

          }

        }

      });

    });

    stream.on('end', () => {

      if (!readable.readableEnded) {

        const finalResponse = {

          id: metadata.id,

          object: 'chat.completion',

          created: metadata.created,

          model: metadata.model,

          choices: [{

            message: { role: 'assistant', content: fullContent.replace(/provided by \[?Easy[Cc]h?[at]?t?\]?\([^)]*\)|provided by Easy[Hh]at|>\s*provided by|provided by.*?eqing\.t[ce]h.*?\)|>\s*|\[EasyCht\]\([^)]*\)|\[Easy[Cc]h?[at]?t?\]\([^)]*\)|\[Easyhat\]\([^)]*\)|Easyhat|easyhat/gi, '').trim() },

            finish_reason: 'stop'

          }]

        };

        readable.push(JSON.stringify(finalResponse));

        readable.push(null);

      }

    });

    stream.on('error', err => readable.emit('error', err));

    return readable;

  }

  async collectFullResponse(stream) {

    return new Promise((resolve, reject) => {

      let fullContent = '';

      let metadata = {};

      stream.on('data', chunk => {

        const buffer = chunk.toString();

        const lines = buffer.split('\n');

        lines.forEach(line => {

          if (line.startsWith('data: ')) {

            const data = line.slice(6).trim();

            if (data && data !== '[DONE]') {

              try {

                const parsed = JSON.parse(data);

                metadata.id = parsed.id || metadata.id;

                metadata.created = parsed.created || metadata.created;

                metadata.model = parsed.model || metadata.model;

                const content = parsed.choices[0]?.delta?.content || '';

                fullContent += content;

                if (parsed.choices[0]?.finish_reason === 'stop') {

                  metadata.finish_reason = 'stop';

                }

              } catch (e) {

              }

            }

          }

        });

      });

      stream.on('end', () => {

        const fullResponse = {

          id: metadata.id,

          object: 'chat.completion',

          created: metadata.created,

          model: metadata.model,

          choices: [{

            message: { role: 'assistant', content: fullContent.replace(/provided by \[?Easy[Cc]h?[at]?t?\]?\([^)]*\)|provided by Easy[Hh]at|>\s*provided by|provided by.*?eqing\.t[ce]h.*?\)|>\s*|\[EasyCht\]\([^)]*\)|\[Easy[Cc]h?[at]?t?\]\([^)]*\)|\[Easyhat\]\([^)]*\)|Easyhat|easyhat/gi, '').trim() },

            finish_reason: metadata.finish_reason || 'stop'

          }]

        };

        resolve(fullResponse);

      });

      stream.on('error', err => reject(err));

    });

  }

}

module.exports = { ChatClient };