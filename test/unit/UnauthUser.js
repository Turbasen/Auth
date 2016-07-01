'use strict';

const assert = require('assert');
const UnauthUser = require('../../lib/User').UnauthUser;

describe('UnauthUser', () => {
  let user;

  beforeEach(() => {
    user = new UnauthUser('123.456.789', {
      limit: 100,
      remaining: 100,
      reset: 123456789,
    });
  });

  describe('new', () => {
    it('returns new UnauthUser', () => assert(user instanceof UnauthUser));
  });

  describe('user.type', () => {
    it('returns "guest"', () => assert.equal(user.type, 'guest'));
  });

  describe('user.auth', () => {
    it('returns false', () => assert.equal(user.auth, false));
  });

  describe('user.name', () => {
    it('returns name', () => assert.equal(user.name, 'guest (123.456.789)'));
  });

  describe('user.isOwner()', () => {
    it('returns false', () => {
      assert.equal(user.isOwner(), false);
      assert.equal(user.isOwner({}), false);
      assert.equal(user.isOwner({ foo: 'bar' }), false);
    });
  });

  describe('user.can()', () => {
    ['OPTIONS', 'HEAD', 'GET'].forEach(method => {
      it(`${method} returns true`, () => {
        assert.equal(user.can(method), true);
      });
    });

    ['POST', 'PUT', 'PATCH'].forEach(method => {
      it(`${method} returns false`, () => {
        assert.equal(user.can(method), false);
      });
    });
  });

  describe('user.query()', () => {
    it('sets "status" to "Offentlig"', () => {
      assert.deepEqual(user.query({}), { status: 'Offentlig' });
      assert.deepEqual(user.query({ status: 'Privat' }), { status: 'Offentlig' });
      assert.deepEqual(user.query({ foo: 'bar', bar: 'FOO' }), {
        foo: 'bar',
        bar: 'FOO',
        status: 'Offentlig',
      });
    });

    it('returns same query when "status" is "Offentlig"', () => {
      const query = { foo: 'bar', bar: 'FOO', status: 'Offentlig' };

      assert.deepEqual(user.query(query), query);
    });
  });
});
