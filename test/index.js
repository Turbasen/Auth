'use strict';

const mongo = require('@turbasen/db-mongo');
const redis = require('@turbasen/db-redis');
const users = require('./support/users');

before(done => {
  if (mongo.db) { return done(); }
  mongo.on('ready', done);
});

beforeEach(done => redis.flushall(done));
beforeEach(function (done) { this.timeout(10000); mongo.db.dropDatabase(done); });
beforeEach(function (done) { this.timeout(10000); mongo.api.users.insert(users, done); });
