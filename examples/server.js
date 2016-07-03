'use strict';

const express = require('express');

const app = module.exports = express();
const auth = require('../');

app.use(auth.middleware);

app.get('/', (req, res) => {
  res.end(`Hello ${req.user.name}`);
});

app.use((err, req, res, next) => {
  res.status(err.code).json(err.toJSON());
});
