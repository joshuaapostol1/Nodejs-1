const { ChatClient } = require('./chatService');

async function main() {
  const chat = new ChatClient({
    model: 'gpt-4o-mini',
    temperature: 0.5,
    presence_penalty: 0,
    frequency_penalty: 0,
    top_p: 1,
    chat_token: 72,
    stream: false
  });

  const messages = [
    {
      role: 'system',
      content: `\nCurrent model: gpt-4o-mini\nCurrent time: ${new Date().toString()}\nLatex inline: $ x^2 $ \nLatex block: $$ e=mc^2 $$\n\n`
    },
    { role: 'user', content: 'what model are you' }
  ];

  try {
    const response = await chat.createChatCompletion({ messages });
    console.log(JSON.stringify(response, null, 2));
  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
}

main();