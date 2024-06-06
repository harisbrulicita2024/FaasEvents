const jwt = require('jsonwebtoken');

const secret = 'ita2024';

const payload = {
  username: 'testUser',
  email: 'test@example.com'
};

const token = jwt.sign(payload, secret, { expiresIn: '1h' });

console.log('Generated JWT Token:', token);
