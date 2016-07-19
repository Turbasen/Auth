'use strict';
/* eslint import/no-extraneous-dependencies: ["error", {"devDependencies": true}] */

const assert = require('assert');
const sinon = require('sinon');
const auth = require('../../');

const mongo = require('@turbasen/db-mongo');
const redis = require('@turbasen/db-redis');

const AuthUser = require('../../lib/AuthUser');
const UnauthUser = require('../../lib/UnauthUser');

describe('auth', () => {
  describe('middleware', () => {
    let middleware;

    let unauthGetByKey;
    let authGetByKey;

    let req;
    let res;

    before(() => {
      unauthGetByKey = UnauthUser.getByKey;
      authGetByKey = AuthUser.getByKey;
    });

    after(() => {
      UnauthUser.getByKey = unauthGetByKey;
      AuthUser.getByKey = authGetByKey;
    });

    beforeEach(() => {
      req = {
        method: 'GET',
        connection: {},
        headers: {},
        query: {},
      };

      res = {
        set: () => { throw new Error('res.set() not implemented'); },
        on: () => { throw new Error('res.set() not implemented'); },
      };

      middleware = auth({ mongo: mongo.users, redis, env: 'prod' });

      UnauthUser.getByKey = () => {
        throw new Error('UnauthUser.getByKey() not implemented');
      };

      AuthUser.getByKey = () => {
        throw new Error('AuthUser.getByKey() not implemented');
      };
    });

    it('returns middleware function', () => {
      assert.equal(typeof middleware, 'function');
    });

    it('looks up user by Authorization header', done => {
      req.headers.authorization = 'Token abc123';
      AuthUser.getByKey = (token) => {
        assert.equal(token, 'abc123');
        done();

        return new Promise(() => {});
      };

      middleware(req, res, assert.fail.bind(assert));
    });

    it('looks up user by URL query parameter', done => {
      req.query.api_key = 'abc123';
      AuthUser.getByKey = (token) => {
        assert.equal(token, 'abc123');
        done();

        return new Promise(() => {});
      };

      middleware(req, res, assert.fail.bind(assert));
    });

    it('looks up user by remote IP', done => {
      req.connection.remoteAddres = '123.456.789';
      UnauthUser.getByKey = (token) => {
        assert.equal(token, '123.456.789');
        done();

        return new Promise(() => {});
      };

      middleware(req, res, assert.fail.bind(assert));
    });

    it('looks up user by X-Forwarded-For header', done => {
      req.connection.remoteAddres = '127.0.0.1';
      req.headers['x-forwarded-for'] = '123.456.789';

      UnauthUser.getByKey = (token) => {
        assert.equal(token, '123.456.789');
        done();

        return new Promise(() => {});
      };

      middleware(req, res, assert.fail.bind(assert));
    });

    it('sets X-RateLimit headers for valid user', done => {
      req.connection.remoteAddres = '127.0.0.1';
      UnauthUser.getByKey = (token) => Promise.resolve(
        new UnauthUser(token, {
          limit: 100,
          remaining: 49,
          reset: 123456789,
        })
      );

      res.set = sinon.spy();
      res.on = sinon.spy();

      middleware(req, res, err => process.nextTick(() => {
        assert.ifError(err);

        assert(res.set.withArgs('X-RateLimit-Limit', 100).calledOnce);
        assert(res.set.withArgs('X-RateLimit-Remaining', 48).calledOnce);
        assert(res.set.withArgs('X-RateLimit-Reset', 123456789).calledOnce);

        done();
      }));
    });
  });

  describe('auth.onFinish()', () => {
    it('uncharges user for 304 and 412 status codes');
    it('updates remaining rate limit in cache');
  });
});
