const puppeteer = require('puppeteer');
const { cleanMoneyMask, dinheiroMask, porcentagemMask } = require('masks-br');

const { checkInternetConnection, calculatePercent } = require('./utils');
const FileManager = require('./file');
const { sendMail } = require('./email');

class App {
  page;

  async start() {
    console.clear();
    console.log('Iniciando Script: ', new Date().toISOString());

    const has_internet = await checkInternetConnection();

    if (!has_internet) {
      console.log('Sem internet no momento');

      return;
    }

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    this.page = await browser.newPage();

    const wish_lists = await FileManager.getLists();

    const products_info = [];

    await wish_lists.reduce(
      (promise, list) =>
        promise.then(async () => {
          const products = await this.getProductsList(list);

          await products.reduce(
            (promise2, product) =>
              promise2.then(async () => {
                const response = await this.getProductInfo(product);

                if (response) {
                  products_info.push(response);
                }
              }),
            Promise.resolve()
          );
        }),
      Promise.resolve()
    );

    await browser.close();

    await this.verifySendEmail(products_info);

    console.log();
    console.log('Finished');
  }

  async getProductsList(wish_list) {
    console.log();
    console.log('Processing wishlist -', wish_list.category);

    await this.page.goto(wish_list.url);

    const listSelector = '#g-items > li';

    const products = await this.page.evaluate((selector) => {
      const list = Array.from(document.querySelectorAll(selector));
      return list.map((data) => {
        const el = data.querySelector('[id^=itemName]');

        return {
          title: el.title,
          url: el.href,
        };
      });
    }, listSelector);

    return products;
  }

  async getProductInfo(product) {
    console.log('Processing product -', product.title);

    try {
      await this.page.goto(product.url);

      const product_price_text = await this.page.$eval('#soldByThirdParty > span, #price_inside_buybox', (el) => el.textContent);

      const product_price = cleanMoneyMask(product_price_text);

      const prod = await FileManager.updateOrCreateProduct(product.title, product.url, product_price);

      const new_price_percent = calculatePercent(prod.lastPrice, prod.latestPrice);

      prod.discountPercent = new_price_percent;

      return prod;
    } catch (err) {
      console.log('Error on search product', err.message);
      return undefined;
    }
  }

  async verifySendEmail(products_info) {
    products_info.sort((a, b) => b.discountPercent - a.discountPercent);

    const products_on_good_price = [];

    let email_content = `Segue a lista de produtos que abaixaram de preço<br /><br /><br />`;
    // <table>
    // <thead>
    //   <tr>
    //     <td>Título</td>
    //     <td>Preço Antigo</td>
    //     <td>Preço Novo</td>
    //     <td>Desconto</td>
    //   </tr>
    // </thead>
    // <tbody>

    products_info.forEach((product) => {
      if (product.discountPercent > 5) {
        products_on_good_price.push(product);

        const price_difference = (product.lastPrice - product.latestPrice).toFixed(2);

        email_content += `O produto <a href="${product.url}" target="_blank">${product.title}</a> que estava com o preço <b>${dinheiroMask(
          product.lastPrice
        )}</b>, agora está por <b>${dinheiroMask(product.latestPrice)}. (${dinheiroMask(price_difference)} - ${porcentagemMask(
          product.discountPercent
        )})</b><br />`;
        // email_content += `
        //   <tr>
        //     <td>${product.title}</td>
        //     <td>${dinheiroMask(product.lastPrice)}</td>
        //     <td>${dinheiroMask(product.latestPrice)}</td>
        //     <td>${dinheiroMask(price_difference)} - ${porcentagemMask(product.discountPercent)}</td>
        //   </tr>
        // `;
      }
    });

    // email_content += '</tbody></table>';

    if (products_on_good_price.length) {
      const [product] = products_on_good_price;

      await sendMail(`${product.title} com ${porcentagemMask(product.discountPercent)} de desconto`, email_content);
    }
  }
}

module.exports = App;
