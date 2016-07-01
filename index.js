'use strict';

const HttpError = require('@starefossen/http-error');
const UnauthUser = require('./lib/User').UnauthUser;
const AuthUser = require('./lib/User').AuthUser;

const CACHE_VALID = process.env.NTB_USER_VALID_CACHE || 60 * 60 * 1000;
const CACHE_INVALID = process.env.NTB_USER_INVALID_CACHE || 24 * 60 * 60 * 1000;
const API_ENV = process.env.NTB_API_ENV || 'dev';
const LIMIT_UNAUTH = process.env.NTB_LIMIT_UNAUTH || 100;

module.exports = opts => {
  const redis = opts.redis;
  const mongo = opts.mongo;
  const env = opts.env || API_ENV;

  return function middleware(req, res, next) {
    let promise;

    // API key through Authorization header
    if (req.headers.authorization) {
      const token = req.headers.authorization.split(' ');
      promise = module.exports.getUserByToken(redis, mongo, env, token[1]);

    // API key through URL query parameter
    } else if (req.query && req.query.api_key) {
      promise = module.exports.getUserByToken(redis, mongo, env, req.query.api_key);

    // No API key
    } else {
      promise = module.exports.getUserByIp(
        redis, mongo, env,
        req.headers['x-forwarded-for'] || req.connection.remoteAddres
      );
    }

    promise.then(user => {
      req.user = user;

      res.set('X-User-Auth', user.auth);
      if (user.auth) {
        res.set('X-User-Provider', user.provider);
      }

      res.set('X-RateLimit-Limit', user.limit);
      res.set('X-RateLimit-Reset', user.reset);

      if (!user.hasRemainingQuota()) {
        res.set('X-RateLimit-Remaining', 0);

        return next(new HttpError(
          403, `API rate limit exceeded for ${user.type} "${user.key}"`
        ));
      }

      res.set('X-RateLimit-Remaining', user.charge());

      if (!user.can(req.method)) {
        return next(new HttpError(
          401, `API authentication required for "${req.method}" requests`
        ));
      }

      res.on('finish', function resOnFinishCb() {
        // Uncharge user when certain cache features are used.
        // 304 Not Modified, and 412 Precondition Failed
        if (this.statusCode === 304 || this.statusCode === 412) {
          this.req.user.uncharge();
        }

        if (this.req.user.getCharge() > 0) {
          redis.hincrby(this.req.user.cacheKey, 'remaining', -1);
        }
      });

      return next();
    }).catch(next);
  };
};

module.exports.getUserByIp = function getUserByIp(redis, mongo, env, key) {
  return new Promise((resolve, reject) => {
    redis.hgetall(AuthUser.getCacheKey(key), (redisErr, data) => {
      if (redisErr) { return reject(redisErr); }

      if (data && data.limit) {
        return resolve(new UnauthUser(key, data));
      } else {
        const expireat = module.exports.expireat(CACHE_VALID);

        const user = new UnauthUser(key, {
          limit: LIMIT_UNAUTH,
          remaining: LIMIT_UNAUTH,
          reset: expireat,
        });

        redis.hmset(AuthUser.getCacheKey(key), user.toObject());
        redis.expireat(AuthUser.getCacheKey(key), expireat);

        return resolve(user);
      }
    });
  });
};

module.exports.getUserByToken = function getUserByToken(redis, mongo, env, key) {
  return new Promise((resolve, reject) => {
    redis.hgetall(UnauthUser.getCacheKey(key), (redisErr, data) => {
      if (redisErr) { return reject(redisErr); }

      if (data && data.access) {
        if (data.access === 'true') {
          return resolve(new AuthUser(key, data));
        } else {
          return reject(new HttpError(`Bad credentials for user "${key}"`, 401));
        }
      }

      const query = {
        [`apps.key.${env}`]: key,
        'apps.active': true,
      };

      const opts = {
        fields: {
          provider: true,
          apps: true,
        },
      };

      return mongo.findOne(query, opts, (mongoErr, doc) => {
        if (mongoErr) { return reject(mongoErr); }

        if (!doc) {
          const expireat = module.exports.expireat(CACHE_INVALID);

          redis.hset(AuthUser.getCacheKey(key), 'access', 'false');
          redis.expireat(AuthUser.getCacheKey(key), expireat);

          return reject(new HttpError(`Bad credentials for user "${key}"`, 401));
        }

        const app = doc.apps.find(item => item.key[env] === key);
        const expireat = module.exports.expireat(CACHE_VALID);

        const user = new AuthUser(key, {
          provider: doc.provider,
          app: app.name,

          limit: app.limit[env],
          remaining: app.limit[env],
          reset: expireat,
        });

        redis.hmset(AuthUser.getCacheKey(key), user.toObject());
        redis.expireat(AuthUser.getCacheKey(key), expireat);

        return resolve(user);
      });
    });
  });
};

module.exports.expireat = function expireat(seconds) {
  return Math.floor((new Date().getTime() + seconds) / 1000);
};
