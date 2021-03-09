const puppeteer = require('puppeteer');
const nodemailer = require('nodemailer');
const { writeFileSync } = require('fs');
const { cleanMoneyMask, dinheiroMask } = require('masks-br');
const { CronJob } = require('cron');

const config = require('./config.json');
const env = require('./env.json');

const { products } = config;

async function updateProductPrice(id, price) {
  const to_update = [...products];

  const new_prods = to_update.map((product) => {
    if (product.id === id) {
      product.latestPrice = Number(price);
    }

    return product;
  });

  const file = {
    ...config,
    products: new_prods,
  };

  const final_file = JSON.stringify(file, null, 2);

  writeFileSync('./config.json', final_file);
}

async function sendMail(productName, content) {
  console.log('Enviando um email', productName);

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

async function fetchProducts() {
  console.log();
  console.log('Iniciando Script');

  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await products.reduce(
    (promise, product) =>
      promise.then(async () => {
        console.log(`\n----------------- ${new Date()} -----------------`);
        console.log(`Buscando informações do produto - ${product.name} \n`);

        await page.goto(product.url);

        const productCurrentPriceText = await page.$eval('#soldByThirdParty > span', (el) => el.textContent);
        const productCurrentPrice = cleanMoneyMask(productCurrentPriceText);
        let mailContent = '';

        if (productCurrentPrice <= product.intendedPrice) {
          console.log(`Produto chegou ao preço que vc quer ${dinheiroMask(productCurrentPrice)}`);

          mailContent += `Produto chegou ao preço que você quer, ${dinheiroMask(productCurrentPrice)}<br/><br/>`;
        }

        if (productCurrentPrice < product.latestPrice) {
          console.log(
            `Produto abaixou de preço, antes estava em ${dinheiroMask(product.latestPrice)}, agora está em ${dinheiroMask(productCurrentPrice)}`
          );

          mailContent += `Produto abaixou de preço, antes estava em ${dinheiroMask(product.latestPrice)}, agora está em ${dinheiroMask(
            productCurrentPrice
          )}<br/><br/>`;
        }

        if (productCurrentPrice !== product.latestPrice) {
          updateProductPrice(product.id, productCurrentPrice);
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
