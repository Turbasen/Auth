'use strict';

const redis = require('@turbasen/db-redis');

const CACHE_VALID = process.env.NTB_CACHE_VALID || 60 * 60 * 1000;

class AbstractUser {
  constructor(type, key, data) {
    this.type = type;
    this.key = key;

    this.provider = data.provider || '';
    this.app = data.app || '';

    this.limit = parseInt(data.limit, 10);
    this.remaining = parseInt(data.remaining, 10);
    this.reset = parseInt(data.reset, 10) || module.exports.expireat(CACHE_VALID);

    this.penalty = 0;
  }

  get cacheKey() {
    return AbstractUser.getCacheKey(this.type, this.key);
  }

  toObject() {
    return {
      access: 'true',

      provider: this.provider,
      app: this.app,

      limit: `${this.limit}`,
      remaining: `${this.remaining - this.penalty}`,
      reset: `${this.reset}`,
    };
  }

  save() {
    redis.hmset(this.cacheKey, this.toObject());
    redis.expireat(this.cacheKey, this.reset);

    return this;
  }

  update() {
    if (this.penalty > 0) {
      redis.hincrby(this.cacheKey, 'remaining', -this.penalty);
    }
  }

  charge() {
    this.penalty = this.penalty + 1;
    return this.remaining - this.penalty;
  }

  uncharge() {
    this.penalty = 0;
    return this.remaining;
  }

  getCharge() {
    return this.penalty;
  }

  hasRemainingQuota() {
    return this.remaining - this.penalty > 0;
  }

  static getCacheKey(type, key) {
    return `api:${type}:${key}`;
  }
}

module.exports = AbstractUser;
module.exports.expireat = s => Math.floor((new Date().getTime() + s) / 1000);
