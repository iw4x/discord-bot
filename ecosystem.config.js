module.exports = {
  apps : [{
    name   : 'iw4x-discord-bot',
    script : './index.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production'
    }
  }]
};