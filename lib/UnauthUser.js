'use strict';

const redis = require('@turbasen/db-redis');
const HttpError = require('@starefossen/http-error');
const AbstractUser = require('./AbstractUser');

const RATELIMIT_UNAUTH = process.env.NTB_RATELIMIT_UNAUTH || 100;
const getMethods = new Set(['OPTIONS', 'HEAD', 'GET']);

class UnauthUser extends AbstractUser {
  constructor(token, data) {
    super('ip', token, data || {
      limit: RATELIMIT_UNAUTH,
      remaining: RATELIMIT_UNAUTH,
    });
  }

  get auth() { return false; }

  get name() {
    return `guest (${this.key})`;
  }

  isOwner() {
    return false;
  }

  can(method) {
    return getMethods.has(method);
  }

  query(query) {
    return Object.assign(query, { status: 'Offentlig' });
  }

  static getCacheKey(key) {
    return super.getCacheKey('ip', key);
  }

  static getByKey(key) {
    return new Promise((resolve, reject) => {
      redis.hgetall(UnauthUser.getCacheKey(key), (redisErr, data) => {
        if (redisErr) { return reject(redisErr); }

        if (data && data.access) {
          if (data.access === 'true') {
            return resolve(new UnauthUser(key, data));
          } else {
            return reject(new HttpError(`Access denied for "${key}"`, 401));
          }
        } else {
          return resolve(new UnauthUser(key).save());
        }
      });
    });
  }
}

module.exports = UnauthUser;
