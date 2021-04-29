const { CronJob } = require('cron');

const App = require('./app');

const price_comparator = new App();

const cron_expression = '0 10-18/2 * * *'; // At 0 minutes past the hour, every 2 hours, between 10:00 AM and 06:59 PM

var job = new CronJob(
  cron_expression, //
  () => {
    price_comparator.start();
  },
  null,
  true,
  'America/Los_Angeles'
);

console.log('Startin Cron Job');
console.log();

job.start();

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((sig) =>
  process.on(sig, async () => {
    console.log('Stoping Cron');
    job.stop();
  })
);

// price_comparator.start();
