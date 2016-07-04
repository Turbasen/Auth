'use strict';

const HttpError = require('@starefossen/http-error');

const AbstractUser = require('./lib/AbstractUser');
const UnauthUser = require('./lib/UnauthUser');
const AuthUser = require('./lib/AuthUser');

module.exports = () => (req, res, next) => {
  let promise;

  // API key through Authorization header
  if (req.headers.authorization) {
    const token = req.headers.authorization.split(' ');
    promise = AuthUser.getByKey(token[1]);

  // API key through URL query parameter
  } else if (req.query && req.query.api_key) {
    promise = AuthUser.getByKey(req.query.api_key);

  // No API key
  } else {
    promise = UnauthUser.getByKey(
      req.headers['x-forwarded-for'] || req.connection.remoteAddres
    );
  }

  promise.then(user => {
    req.user = user;

    // X-User headers
    res.set('X-User-Auth', user.auth);
    if (user.auth) {
      res.set('X-User-Provider', user.provider);
    }

    // X-Rate-Limit headers
    res.set('X-RateLimit-Limit', user.limit);
    res.set('X-RateLimit-Reset', user.reset);

    // Check if user has remaining rate limit quota
    if (!user.hasRemainingQuota()) {
      res.set('X-RateLimit-Remaining', 0);

      return next(new HttpError(
        `API rate limit exceeded for ${user.type} "${user.key}"`, 403
      ));
    }

    // Charge user for this request
    res.set('X-RateLimit-Remaining', user.charge());

    // Check if user can execute the HTTP method. Only authenticated users are
    // allowed to execute POST, PUT, and DELETE requests.
    if (!user.can(req.method)) {
      return next(new HttpError(
        `API authentication required for "${req.method}" requests`, 401
      ));
    }

    // Attach the on finish callback which updates the user rate limit in cache.
    res.on('finish', module.exports.onFinish);

    return next();
  }).catch(next);
};

module.exports.onFinish = function onFinish() {
  // Uncharge user when certain cache features are used.
  // 304 Not Modified, and 412 Precondition Failed
  if (this.statusCode === 304 || this.statusCode === 412) {
    this.req.user.uncharge();
  }

  // Update user rate-limit in cache if it has changed.
  this.req.user.update();
};

module.exports.middleware = module.exports();
module.exports.AbstractUser = AbstractUser;
module.exports.AuthUser = AuthUser;
module.exports.UnauthUser = UnauthUser;
