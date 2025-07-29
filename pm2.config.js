'use strict';

module.exports = {
  apps : [{
    name: "channel-enemy-bot",
    script: 'build.js',
    instances: 1,
    kill_timeout: 5 * 1000,
    watch: false,
    env: {
      TZ: "UTC"
    }
  }]
};
