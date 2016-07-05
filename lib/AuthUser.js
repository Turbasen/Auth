'use strict';

const mongo = require('@turbasen/db-mongo');
const redis = require('@turbasen/db-redis');
const HttpError = require('@starefossen/http-error');
const AbstractUser = require('./AbstractUser');

const CACHE_INVALID = process.env.NTB_CACHE_INVALID || 24 * 60 * 60 * 1000;
const API_ENV = process.env.NTB_API_ENV || 'dev';

class AuthUser extends AbstractUser {
  constructor(token, data) {
    super('token', token, data);
  }

  get auth() { return true; }

  get name() {
    return `${this.provider} (${this.app})`;
  }

  isOwner(doc) {
    return !!doc.tilbyder && !!this.provider && this.provider === doc.tilbyder;
  }

  can() {
    return true;
  }

  query(query) {
    const publicStatus = new Set('Offentlig', 'Slettet');

    if (query.tilbyder) {
      if (query.tilbyder === this.provider) {
        return query;
      } else {
        return Object.assign(query, { status: 'Offentlig' });
      }
    } else if (query.status) {
      if (publicStatus.has(query.status)) {
        return query;
      } else {
        return Object.assign(query, { tilbyder: this.provider });
      }
    } else {
      return Object.assign(query, {
        $or: [{ tilbyder: this.provider }, { status: 'Offentlig' }],
      });
    }
  }

  static getCacheKey(key) {
    return super.getCacheKey('token', key);
  }

  static getFromMongo(key) {
    return new Promise((resolve, reject) => {
      const query = { [`apps.key.${API_ENV}`]: key, 'apps.active': true };
      const opts = { fields: { provider: true, apps: true } };

      mongo.api.users.findOne(query, opts).then(doc => {
        if (!doc) {
          const expireat = AbstractUser.expireat(CACHE_INVALID);

          redis.hset(AuthUser.getCacheKey(key), 'access', 'false');
          redis.expireat(AuthUser.getCacheKey(key), expireat);

          reject(new HttpError(`Bad credentials for user "${key}"`, 401));
        } else {
          const app = doc.apps.find(item => item.key[API_ENV] === key);

          const user = new AuthUser(key, {
            provider: doc.provider,
            app: app.name,

            limit: app.limit[API_ENV],
            remaining: app.limit[API_ENV],
          });

          resolve(user.save());
        }
      }).catch(reject);
    });
  }

  static getByKey(key) {
    return new Promise((resolve, reject) => {
      redis.hgetall(AuthUser.getCacheKey(key)).then(data => {
        if (data && data.access) {
          if (data.access === 'true') {
            resolve(new AuthUser(key, data));
          } else {
            reject(new HttpError(`Bad credentials for user "${key}"`, 401));
          }
        } else {
          AuthUser.getFromMongo(key).then(resolve).catch(reject);
        }
      }).catch(reject);
    });
  }
}

module.exports = AuthUser;
