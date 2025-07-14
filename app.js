// app.js
const express = require('express');
const bodyParser = require('body-parser');
const inventoryRoutes = require('./routes/inventory');
const productRoutes = require('./routes/products');

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/inventory', inventoryRoutes);
app.use('/api/products', productRoutes);

module.exports = app;
