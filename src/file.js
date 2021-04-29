const { writeFileSync, readFileSync } = require('fs');

const config = require('../data/config.json');

class FileManager {
  async getLists() {
    return config.lists;
  }

  async getProducts() {
    const data = this.readFile();

    return data.products;
  }

  /** Função que atualiza o preço de um produto */
  async updateOrCreateProduct(title, url, price) {
    title.trim();
    url.trim();

    const old_products = await this.getProducts();

    let find_product = old_products.find((prod) => prod.title === title);

    if (find_product) {
      find_product.lastPrice = find_product.latestPrice;
      find_product.latestPrice = price;
    } else {
      const product = {
        title,
        url,
        lastPrice: price,
        latestPrice: price,
      };

      old_products.push(product);

      find_product = product;
    }

    const data = this.readFile();

    const file = {
      ...data,
      products: old_products,
    };

    const final_file = JSON.stringify(file, null, 2);

    this.updateFile(final_file);

    return find_product;
  }

  readFile() {
    try {
      const buffer = readFileSync('./data/data.json');

      return JSON.parse(buffer);
    } catch (err) {
      const payload = {
        products: [],
      };

      this.updateFile(payload);

      return payload;
    }
  }

  /** Função que atualiza o arquivo */
  updateFile(file_payload) {
    return writeFileSync('./data/data.json', file_payload);
  }
}

module.exports = new FileManager();
