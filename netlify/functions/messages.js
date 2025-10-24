const { MongoClient, ObjectId } = require('mongodb');

let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) {
    return cachedDb;
  }

  const client = await MongoClient.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  const db = client.db('discord');
  cachedDb = db;
  return db;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const db = await connectToDatabase();
    const messages = db.collection('messages');

    // GET - pobierz wiadomości
    if (event.httpMethod === 'GET') {
      const { chatId, serverId, channelId } = event.queryStringParameters || {};

      let query = {};
      
      if (chatId) {
        query.chatId = chatId;
      } else if (serverId && channelId) {
        query.serverId = serverId;
        query.channelId = channelId;
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing parameters' }),
        };
      }

      const messagesList = await messages
        .find(query)
        .sort({ timestamp: 1 })
        .limit(100)
        .toArray();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(messagesList),
      };
    }

    // POST - wyślij wiadomość
    if (event.httpMethod === 'POST') {
      const { chatId, serverId, channelId, author, content } = JSON.parse(event.body);

      if (!author || !content) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Missing required fields' }),
        };
      }

      const newMessage = {
        author,
        content,
        timestamp: new Date(),
      };

      if (chatId) {
        newMessage.chatId = chatId;
      } else if (serverId && channelId) {
        newMessage.serverId = serverId;
        newMessage.channelId = channelId;
      } else {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Must specify either chatId or serverId+channelId' }),
        };
      }

      const result = await messages.insertOne(newMessage);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          messageId: result.insertedId,
          message: newMessage,
        }),
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error', details: error.message }),
    };
  }
};