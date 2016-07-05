'use strict';

const assert = require('assert');

const redis = require('@turbasen/db-redis');
const AbstractUser = require('../../lib/AbstractUser');

describe('AbstractUser', () => {
  let user;

  beforeEach(() => {
    user = new AbstractUser('type', 'key', {
      limit: 100,
      remaining: 100,
      reset: 9999999999,
    });
  });

  describe('new', () => {
    it('returns new AbstractUser', () => assert(user instanceof AbstractUser));
    it('returns new AbstractUser with default rate-limit reset', () => {
      assert(new AbstractUser('type', 'key', {
        limti: 100,
        remaining: 100,
      }).reset > Math.floor(new Date().getTime() / 1000));
    });
  });

  describe('user.cacheKey', () => {
    it('returns cache key for type and key', () => {
      assert.equal(user.cacheKey, 'api:type:key');
    });
  });

  describe('user.toObject()', () => {
    it('returns user as JSON Object', () => {
      assert.deepEqual(user.toObject(), {
        access: 'true',
        app: '',
        limit: '100',
        provider: '',
        remaining: '100',
        reset: '9999999999',
      });
    });
  });

  describe('user.save()', () => {
    it('user is not saved by default', done => {
      redis.hgetall(user.cacheKey).then(data => {
        assert.deepEqual(data, {});
        done();
      });
    });

    it('saves user to Redis cache', done => {
      user.save();

      redis.hgetall(user.cacheKey).then(data => {
        assert.deepEqual(data, user.toObject());
        done();
      });
    });

    it('expires cache at reset time', done => {
      user.save();

      redis.ttl(user.cacheKey).then(ttl => process.nextTick(() => {
        assert(ttl > 0);
        done();
      }));
    });
  });

  describe('user.update()', () => {
    it('updates remaining rate limit in Redis cache', done => {
      user.save();
      user.charge();
      user.update();

      redis.hget(user.cacheKey, 'remaining')
        .then(remaining => process.nextTick(() => {
          assert.equal(remaining, '99');
          done();
        }));
    });
  });

  describe('user.charge()', () => {
    it('increments penalty by one (1)', () => {
      assert.equal(user.penalty, 0);

      user.charge();
      assert.equal(user.penalty, 1);

      user.charge();
      assert.equal(user.penalty, 2);
    });

    it('returns updated remaining quota', () => {
      assert.equal(user.charge(), 99);
      assert.equal(user.charge(), 98);
    });
  });

  describe('user.uncharge()', () => {
    it('resets penalty to zero (0)', () => {
      user.charge();
      user.charge();
      user.uncharge();
      assert.equal(user.penalty, 0);
    });

    it('returns updated remaining quota', () => {
      user.charge();
      user.charge();
      assert.equal(user.uncharge(), 100);
    });
  });

  describe('user.getCharge()', () => {
    it('returns the current penalty', () => {
      assert.equal(user.getCharge(), 0);
      user.charge();
      user.charge();
      assert.equal(user.getCharge(), 2);
    });
  });

  describe('user.hasRemainingQuota()', () => {
    it('returns true when user has remaining quota', () => {
      assert.equal(user.hasRemainingQuota(), true);
    });

    it('returns false when user has no remaining quota', () => {
      user.remaining = 0;
      assert.equal(user.hasRemainingQuota(), false);
    });
  });

  describe('User.getCacheKey()', () => {
    it('returns cach key for type and key');
  });
});
