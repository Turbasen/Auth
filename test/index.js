'use strict';

const mongo = require('./support/mongo');
const redis = require('./support/redis');
const users = require('./support/users');

before(done => mongo.on('ready', done));
beforeEach(done => redis.flushall(done));
beforeEach(function (done) { this.timeout(10000); mongo.db.dropDatabase(done); });
beforeEach(function (done) { this.timeout(10000); mongo.users.insert(users, done); });
