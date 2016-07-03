'use strict';

const getMethods = new Set(['OPTIONS', 'HEAD', 'GET']);
// const setMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

class AbstractUser {
  constructor(type, key, data) {
    this.type = type;
    this.key = key;

    this.provider = data.provider || null;
    this.app = data.app || null;

    this.limit = parseInt(data.limit, 10);
    this.remaining = parseInt(data.remaining, 10);
    this.reset = parseInt(data.reset, 10);

    this.penalty = 0;
  }

  static getCacheKey(type, key) {
    return `api:${type}:${key}`;
  }

  get cacheKey() {
    return `api:${this.type}:${this.key}`;
  }

  toObject() {
    return {
      access: 'true',

      provider: this.provider,
      app: this.app,

      limit: this.limit,
      remaining: this.remaining - this.penalty,
      reset: this.reset,
    };
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
}

class AuthUser extends AbstractUser {
  constructor(token, data) {
    super('token', token, data);
  }

  get auth() { return true; }

  get name() {
    return `${this.provider} (${this.app})`;
  }

  static getCacheKey(key) {
    return super.getCacheKey('token', key);
  }

  isOwner(doc) {
    return !!doc.tilbyder && this.provider === doc.tilbyder;
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
}

class UnauthUser extends AbstractUser {
  constructor(token, data) {
    super('ip', token, data);
  }

  get auth() { return false; }

  get name() {
    return `guest (${this.key})`;
  }

  static getCacheKey(key) {
    return super.getCacheKey('ip', key);
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
}

module.exports = {
  AbstractUser,
  UnauthUser,
  AuthUser,
};
