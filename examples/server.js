'use strict';

const express = require('express');
const mongo = require('../test/support/mongo');
const redis = require('../test/support/redis');

const app = module.exports = express();
const auth = require('../');

app.use(auth({
  mongo: mongo.users,
  redis,
}));

app.get('/', (req, res) => {
  res.end(`Hello ${req.user.name}`);
});

app.use((err, req, res, next) => {
  res.status(err.code).json(err.toJSON());
});
