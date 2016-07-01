'use strict';

const assert = require('assert');
const AbstractUser = require('../../lib/User').AbstractUser;

describe('AbstractUser', () => {
  let user;

  beforeEach(() => {
    user = new AbstractUser('token', {
      limit: 100,
      remaining: 100,
      reset: 123456789,
    });
  });

  describe('new', () => {
    it('returns new AbstractUser', () => assert(user instanceof AbstractUser));
  });

  describe('toObject()', () => {
    it('returns user as JSON Object', () => {
      assert.deepEqual(user.toObject(), {
        access: 'true',
        app: null,
        limit: 100,
        provider: null,
        remaining: 100,
        reset: 123456789,
      });
    });
  });

  describe('charge()', () => {
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

  describe('uncharge()', () => {
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

  describe('getCharge()', () => {
    it('returns the current penalty', () => {
      assert.equal(user.getCharge(), 0);
      user.charge();
      user.charge();
      assert.equal(user.getCharge(), 2);
    });
  });

  describe('hasRemainingQuota()', () => {
    it('returns true when user has remaining quota', () => {
      assert.equal(user.hasRemainingQuota(), true);
    });

    it('returns false when user has no remaining quota', () => {
      user.remaining = 0;
      assert.equal(user.hasRemainingQuota(), false);
    });
  });
});
