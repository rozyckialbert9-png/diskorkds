const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

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
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const { action, username, password } = JSON.parse(event.body);
    const db = await connectToDatabase();
    const users = db.collection('users');

    if (action === 'register') {
      // Sprawdź czy użytkownik już istnieje
      const existingUser = await users.findOne({ username });
      if (existingUser) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Użytkownik już istnieje' }),
        };
      }

      // Hashuj hasło
      const hashedPassword = await bcrypt.hash(password, 10);

      // Stwórz użytkownika
      const newUser = {
        username,
        password: hashedPassword,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
        banner: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        status: 'Hej, jestem nowy na tej platformie!',
        createdAt: new Date(),
        friends: [],
      };

      await users.insertOne(newUser);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Użytkownik utworzony',
          user: {
            username: newUser.username,
            avatar: newUser.avatar,
            banner: newUser.banner,
            status: newUser.status,
          },
        }),
      };
    }

    if (action === 'login') {
      // Znajdź użytkownika
      const user = await users.findOne({ username });
      if (!user) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Nieprawidłowy login lub hasło' }),
        };
      }

      // Sprawdź hasło
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return {
          statusCode: 401,
          headers,
          body: JSON.stringify({ error: 'Nieprawidłowy login lub hasło' }),
        };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          user: {
            username: user.username,
            avatar: user.avatar,
            banner: user.banner,
            status: user.status,
            friends: user.friends || [],
          },
        }),
      };
    }

    return {
      statusCode: 400,
      headers,
      body: JSON.stringify({ error: 'Invalid action' }),
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