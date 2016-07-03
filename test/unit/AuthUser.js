'use strict';

const assert = require('assert');
const AuthUser = require('../../lib/User').AuthUser;

describe('AuthUser', () => {
  let user;

  beforeEach(() => {
    user = new AuthUser('abc123', {
      provider: 'FOO',
      app: 'foo_app1',
      limit: 100,
      remaining: 100,
      reset: 123456789,
    });
  });

  describe('new', () => {
    it('returns new UnauthUser', () => assert(user instanceof AuthUser));
  });

  describe('user.type', () => {
    it('returns "token"', () => assert.equal(user.type, 'token'));
  });

  describe('user.auth', () => {
    it('returns true', () => assert.equal(user.auth, true));
  });

  describe('user.name', () => {
    it('returns name', () => assert.equal(user.name, 'FOO (foo_app1)'));
  });

  describe('user.isOwner()', () => {
    it('returns false when document tilbyder is undefined', () => {
      assert.equal(user.isOwner({}), false);
    });

    it('returns false when document tilbyder != user provider', () => {
      assert.equal(user.isOwner({ tilbyder: 'other' }), false);
    });

    it('returns true when document tilbyder = user provider', () => {
      assert.equal(user.isOwner({ tilbyder: 'FOO' }), true);
    });
  });

  describe('user.can()', () => {
    ['OPTIONS', 'HEAD', 'GET', 'POST', 'PUT', 'PATCH'].forEach(method => {
      it(`${method} returns true`, () => {
        assert.equal(user.can(method), true);
      });
    });
  });

  describe('user.query()', () => {
    it('returns query when query tilbyder is the user', () => {
      const query = { foo: 'bar', tilbyder: 'FOO' };
      assert.deepEqual(user.query(query), query);
    });

    it('sets status when query tilbyder is not the user', () => {
      const query = { foo: 'bar', tilbyder: 'other' };
      assert.deepEqual(user.query(query), {
        foo: 'bar',
        tilbyder: 'other',
        status: 'Offentlig',
      });
    });

    ['Offentlig', 'Slettet'].forEach(status => {
      it(`returns query when query status is ${status}`, () => {
        const query = { foo: 'bar', status };
        assert.deepEqual(user.query(query), query);
      });
    });

    ['Privat', 'Kladd', { $ne: 'Offentlig' }].forEach(status => {
      it(`sets tilbyder when query status is ${status.toString()}`, () => {
        const query = { foo: 'bar', status };
        assert.deepEqual(user.query(query), {
          foo: 'bar',
          status,
          tilbyder: 'FOO',
        });
      });
    });

    it('sets $or query when query is empty', () => {
      assert.deepEqual(user.query({}), {
        $or: [{ tilbyder: 'FOO' }, { status: 'Offentlig' }],
      });
    });

    it('sets $or query when status or tilbyder is not set', () => {
      assert.deepEqual(user.query({ foo: 'bar' }), {
        foo: 'bar',
        $or: [{ tilbyder: 'FOO' }, { status: 'Offentlig' }],
      });
    });
  });
});
