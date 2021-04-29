const https = require('https');

function calculatePercent(lastPrice, newPrice) {
  return Number((100 - (100 * newPrice) / lastPrice).toFixed(2));
}

/**
 * @returns {Promise<boolean>} Connection verification
 */
function checkInternetConnection() {
  return new Promise((res) => {
    https.get('https://www.amazon.com.br/', function (response) {
      if (response.statusCode !== 200) {
        res(false);
      }

      res(true);
    });
  });
}

module.exports = {
  calculatePercent,
  checkInternetConnection,
};
