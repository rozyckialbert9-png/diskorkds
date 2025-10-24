const { MongoClient } = require('mongodb');

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
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    const db = await connectToDatabase();
    const users = db.collection('users');

    // GET - pobierz użytkownika lub listę użytkowników
    if (event.httpMethod === 'GET') {
      const { username, search } = event.queryStringParameters || {};

      if (username) {
        const user = await users.findOne({ username }, { projection: { password: 0 } });
        if (!user) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' }),
          };
        }
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(user),
        };
      }

      if (search) {
        const foundUsers = await users
          .find(
            { username: { $regex: search, $options: 'i' } },
            { projection: { password: 0 }, limit: 10 }
          )
          .toArray();
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(foundUsers),
        };
      }

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing parameters' }),
      };
    }

    // PUT - aktualizuj profil
    if (event.httpMethod === 'PUT') {
      const { username, avatar, banner, status } = JSON.parse(event.body);

      const updateData = {};
      if (avatar) updateData.avatar = avatar;
      if (banner) updateData.banner = banner;
      if (status !== undefined) updateData.status = status;

      await users.updateOne({ username }, { $set: updateData });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, message: 'Profile updated' }),
      };
    }

    // POST - operacje na znajomych
    if (event.httpMethod === 'POST') {
      const { action, username, friendUsername } = JSON.parse(event.body);

      if (action === 'add_friend') {
        // Dodaj znajomego
        await users.updateOne(
          { username },
          { $addToSet: { friends: friendUsername } }
        );
        await users.updateOne(
          { username: friendUsername },
          { $addToSet: { friends: username } }
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'Friend added' }),
        };
      }

      if (action === 'remove_friend') {
        // Usuń znajomego
        await users.updateOne(
          { username },
          { $pull: { friends: friendUsername } }
        );
        await users.updateOne(
          { username: friendUsername },
          { $pull: { friends: username } }
        );

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, message: 'Friend removed' }),
        };
      }

      if (action === 'get_friends') {
        // Pobierz listę znajomych
        const user = await users.findOne({ username });
        if (!user) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'User not found' }),
          };
        }

        const friendsList = await users
          .find(
            { username: { $in: user.friends || [] } },
            { projection: { password: 0 } }
          )
          .toArray();

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(friendsList),
        };
      }
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