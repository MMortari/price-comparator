const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const { writeFileSync } = require('fs');
const { cleanMoneyMask, dinheiroMask, porcentagemMask } = require('masks-br');
const { CronJob } = require('cron');
const https = require('https');

const config = require('./config.json');
const env = require('./env.json');

const { products } = config;

async function updateProductPrice(index, price) {
  const new_products = [...products];

  new_products[index].latestPrice = Number(price);

  const file = {
    ...config,
    products: new_products,
  };

  const final_file = JSON.stringify(file, null, 2);

  writeFileSync('./config.json', final_file);
}

async function sendMail(productName, content) {
  const transporter = nodemailer.createTransport({
    host: env.email.host,
    port: env.email.port,
    secure: true,
    auth: {
      user: env.email.user,
      pass: env.email.pass,
    },
  });

  return transporter.sendMail({
    from: env.email.email,
    to: env.email.email,
    subject: `Alerta de Preços - ${productName}`,
    text: content,
    html: content,
  });
}

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

async function fetchProducts() {
  console.log();
  console.log('Iniciando Script');

  const check_connection = await checkInternetConnection();

  if (!check_connection) {
    console.log('Stopping script, no internet connection!');
    return;
  }

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await products.reduce(
    (promise, product, index) =>
      promise.then(async () => {
        console.log(`\n----------------- ${new Date()} -----------------`);
        console.log(`Buscando informações do produto - ${product.name} \n`);

        await page.goto(product.url);

        const productCurrentPriceText = await page.$eval('#soldByThirdParty > span', (el) => el.textContent);
        const productCurrentPrice = cleanMoneyMask(productCurrentPriceText);
        let mailContent = '';

        if (productCurrentPrice <= product.intendedPrice) {
          console.log(`Produto chegou ao preço que você quer, ${dinheiroMask(productCurrentPrice)}`);

          mailContent += `Produto chegou ao preço que você quer, ${dinheiroMask(productCurrentPrice)}<br/><br/>`;
        }

        if (productCurrentPrice < product.latestPrice) {
          const newPricePercent = calculatePercent(product.latestPrice, productCurrentPrice);

          console.log(
            `Produto abaixou de preço, antes estava em ${dinheiroMask(product.latestPrice)}, agora está em ${dinheiroMask(
              productCurrentPrice
            )}. Total de ${porcentagemMask(newPricePercent)} de desconto!`
          );

          mailContent += `Produto abaixou de preço, antes estava em ${dinheiroMask(product.latestPrice)}, agora está em ${dinheiroMask(
            productCurrentPrice
          )}. Total de ${porcentagemMask(newPricePercent)} de desconto!<br/><br/>`;
        }

        if (productCurrentPrice !== product.latestPrice) {
          updateProductPrice(index, productCurrentPrice);
        }

        if (mailContent !== '') {
          mailContent += product.url;

          await sendMail(product.name, mailContent);
        }
      }),
    Promise.resolve()
  );

  await browser.close();
}

var job = new CronJob('0 10-18/2 * * *', () => fetchProducts(), null, true, 'America/Los_Angeles');

job.start();

['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach((sig) =>
  process.on(sig, async () => {
    console.log('Stoping Cron');
    job.stop();
  })
);
