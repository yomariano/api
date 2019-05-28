#!/usr/bin/env node

var cors = require("cors");
var keys = require("./config");
var service = require(".");
var gcm = require("node-gcm");
var https = require('https');
var fs = require('fs');
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const app = express();

var options = {
  key: fs.readFileSync( './localhost.key' ),
  cert: fs.readFileSync( './localhost.cert' ),
  requestCert: false,
  rejectUnauthorized: false
};


var port = process.env.PORT || 34343;
var server = https.createServer( options, app );


app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Set static path
app.use(express.static(path.join(__dirname, "public")));
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(bodyParser.json());

app.use(cors());

// Set up the sender with your GCM/FCM API key (declare this once for multiple messages)
var sender = new gcm.Sender(keys.SERVER_KEY);

// Specify which registration IDs to deliver the message to
var regTokens = [keys.TOKEN];

// Actually send the message
// Subscribe Route
app.post("/cancel", async (req, res) => {
  console.log("req => ", req.body.token, "\n");
  let currencies = await service.returnOpenOrders(
    req.body.token,
    keys.WALLET_ADDRESS
  );
  console.log("currencies => ", currencies, "\n");

  let orderHashes = currencies.map(function(el) {
    return el.orderHash;
  });
  console.log("orderHashes => ", orderHashes, "\n");

  let nonce = await service.returnNextNonce(req.body.wallet);
  console.log("result => ", nonce.nonce, "\n");

  service
    .cancel(orderHashes[0], nonce.nonce, req.body.privateKey)
    .then(response => {
      var message = new gcm.Message({
        data: { title: "Cancel", message: response }
      });

      sender.send(message, { registrationTokens: regTokens }, function(
        err,
        response
      ) {
        if (err) console.error(err);
        else console.log(response);
      });

      res.send(
        req.body.action + req.body.price + req.body.quantity + req.body.token
      );
    })
    .catch(error => {
      console.log(error);
      var message = new gcm.Message({
        data: { title: "Error", message: error }
      });

      sender.send(message, { registrationTokens: regTokens }, function(
        err,
        response
      ) {
        if (err) console.error(err);
        else console.log(response);
      });
    });
});

  // Subscribe Route
  app.post("/order", async (req, res) => {
    
    let ticker = await service.returnTicker("ETH_" + req.body.token.toString());
    let token = await service.returnCurrency(req.body.token.toString());
    let price = ticker.last * req.body.price;
    let quantity = req.body.quantity;


    service
      .order(req.body.action, price, quantity, token, req.body.privateKey)
      .then(response => {
        var message = new gcm.Message({
          data: { title: "Order", message: response }
        });

        sender.send(message, { registrationTokens: regTokens }, function(
          err,
          response
        ) {
          if (err) console.error(err);
          else console.log(response);
        });

        res.send(
          req.body.action + req.body.price + req.body.quantity + req.body.token
        );
      })
      .catch(error => {
        console.log(error);
        var message = new gcm.Message({
          data: { title: "Error", message: error }
        });

        sender.send(message, { registrationTokens: regTokens }, function(
          err,
          response
        ) {
          if (err) console.error(err);
          else console.log(response);
        });
      });
  });

server.listen(port, () => console.log(`Server started on port ${port}`));
