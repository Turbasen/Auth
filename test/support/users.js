'use strict';

const ObjectID = require('mongodb').ObjectID;

module.exports = [
  {
    _id: new ObjectID('100000000000000000000000'),
    provider: 'FOO',
    apps: [
      {
        _id: new ObjectID('100000000000000000000001'),
        name: 'foo_app1',
        limit: {
          test: 499,
          dev: 500,
          prod: 5000,
        },
        key: {
          test: 'foo_app1_test',
          dev: 'foo_app1_dev',
          prod: 'foo_app1_prod',
        },
        active: true,
      },
    ],
  }, {
    _id: new ObjectID('200000000000000000000000'),
    provider: 'FOO',
    apps: [
      {
        _id: new ObjectID('200000000000000000000001'),
        name: 'bar_app1',
        limit: {
          test: 499,
          dev: 500,
          prod: 5000,
        },
        key: {
          test: 'bar_app1_test',
          dev: 'bar_app1_dev',
          prod: 'bar_app1_prod',
        },
        active: true,
      }, {
        _id: new ObjectID('200000000000000000000002'),
        name: 'bar_app2',
        limit: {
          test: 499,
          dev: 500,
          prod: 5000,
        },
        key: {
          test: 'bar_app2_test',
          dev: 'bar_app2_dev',
          prod: 'bar_app2_prod',
        },
        active: true,
      },
    ],
  },
];
