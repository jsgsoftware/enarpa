// Middleware de autenticación
module.exports = function authenticate(req, res, next) {
  const clientId = req.headers['x-client-id'];
  const clientSecret = req.headers['x-client-secret'];

  if (
    clientId === process.env.CLIENT_ID &&
    clientSecret === process.env.CLIENT_SECRET
  ) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
};
