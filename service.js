module.exports = function() {
    'use strict';
    const WebSocket = require('ws');
    const axios = require('axios');
    const ethereumjs = require('ethereumjs-util');
    const web3 = require('web3-utils');
    const { mapValues } = require('lodash');
    var BigNumber = require('bignumber.js');
    BigNumber.config({ EXPONENTIAL_AT : 1e+9 })
    const API_URL = 'https://api.idex.market/'
    const _wallet_address = "0x6912cCC1E60d282607cb88D55E9bf20c2e06a13c"
    const _eth_token = "0x0000000000000000000000000000000000000000"
    const _private_key = null
    const _contract_address = null
    const _currency_addresses = {}

    async function api(action, json = {}, api_url = null) {
        const userAgent = 'Mozilla/4.0 (compatible; Node IDEX API)';
        const contentType = 'application/json';
        let headers = {
             'User-Agent': userAgent,
            'Content-type': contentType
        };

        try {
            const response = await axios.request({
                url: action,
                headers: headers,
                method: 'POST',
                baseURL: api_url = null ? API_URL : api_url,
                data: json
            });

            if ( response && response.status !== 200 ) return new Error(JSON.stringify(response.data));
            return response.data;
        } catch (error) {
            console.log(error.response.data)
            return new Error(error.response);
        }
    };

    return {
        toWei:  function toWei(eth, decimals) { return new  BigNumber(String(eth)).times(new BigNumber(10 ** decimals)).floor().toString()},
        toEth:  function toEth(wei, decimals) { return new BigNumber(String(wei)).div(new BigNumber(10 ** decimals))},
        returnCurrency: async function returnCurrency(currency){
            let currencies = await api(`returnCurrencies`)
            let res =  currencies[currency];
            return res;
        },
        returnSignature: async function returnSignature(msgToSignIn,privateKeyIn){
            const privateKey = privateKeyIn.substring(0, 2) === '0x' ?
            privateKeyIn.substring(2, privateKeyIn.length) : privateKeyIn;
            const salted = ethereumjs.hashPersonalMessage(ethereumjs.toBuffer(msgToSignIn))
            const sig = mapValues(ethereumjs.ecsign(salted, new Buffer(privateKey, 'hex')), (value, key) => key === 'v' ? value : ethereumjs.bufferToHex(value));
            return sig;
        },
        returnOrderBookForUser: async function returnOrderBookForUser(address) {
            return await api(`returnOrderBookForUser`, {address}, 'https://api-regional.idex.market/')
        },
        returnTicker: async function returnTicker(ticker) {
            const json = { market: `${ticker}` }
            return await api(`returnTicker`, json)
        },
        returnTickers: async function returnTickers(ticker) {
            return await returnTicker()
        },
        return24Volume: async function return24Volume() {
            return await api(`return24Volume`)
        },
        returnOpenOrders: async function returnOpenOrders(market, address = null) {
            return await api(`returnOpenOrders`, { market, address })
        },
        returnOrderBook: async function returnOrderBook(market) {
            return await api(`returnOrderBook`, { market })
        },
        returnTradeHistory: async function returnTradeHistory(market, address, start, end, sort, count, cursor) {
            return await api(`returnTradeHistory`, { market, address, start, end, sort, count, cursor })
        },
        returnCurrencies: async function returnCurrencies() {
            return await api(`returnCurrencies`)
        },
        returnBalances: async function returnBalances(address) {
            return await api(`returnBalances`, { address } )
        },
        returnCompleteBalances: async function returnCompleteBalances(address) {
            return await api(`returnCompleteBalances`, { address })
        },
        returnDepositsWithdrawals: async function returnDepositsWithdrawals() {
            return await api(`returnDepositsWithdrawals`)
        },
        returnOrderTrades: async function returnOrderTrades() {
            return await api(`returnOrderTrades`)
        },
        returnNextNonce: async function returnNextNonce(address) {
            return await api(`returnNextNonce`, {address})
        },
        returnContractAddress: async function returnContractAddress(address) {
            return await api(`returnContractAddress`, {address})
        },
        /**
         * order
         * @param {action} num1 The first number to add.
         * @param {price} num2 The second number to add.
         * @return {quantity} The result of adding num1 and num2.
         * @return {token} The result of adding num1 and num2.
         */
        order: async function order(action, price, quantity,token, privateKey) {
            let res = await this.returnNextNonce(_wallet_address);
       
            let contractAddress = await this.returnContractAddress(_wallet_address);

            let amountBigNum = new BigNumber(String(quantity));
            let amountBaseBigNum = new BigNumber(String(quantity * price));
            let tokenBuy = action === 'buy' ? token.address : _eth_token
            let tokenSell = action === 'sell' ? token.address : _eth_token
            const amountBuy = action === 'buy' ?
            this.toWei(amountBigNum, token.decimals) :
            this.toWei(amountBaseBigNum, 18);
            const amountSell = action === 'sell' ?
            this.toWei(amountBigNum, token.decimals) :
            this.toWei(amountBaseBigNum, 18);

            console.log("amountBuy => ", amountBuy)
            console.log("amountBuy => ", amountSell)
            //"amountBuy": "",//"156481944430762460",
            // "amountSell": "",//"20511560000000000000000",
            // price 0.00000762
            // quantity 20511.56
            // total 0.15648194

            let args = {
                "contractAddress": contractAddress.address,
                "tokenBuy": tokenBuy.toString(),
                "amountBuy": amountBuy,
                "tokenSell": tokenSell.toString(),
                "amountSell": amountSell,
                "expires": 100000,
                "nonce": res.nonce,
                "address": _wallet_address
              }

              let raw = web3.soliditySha3({
                t: 'address',
                v: args.contractAddress
              }, {
                t: 'address',
                v: args.tokenBuy
              }, {
                t: 'uint256',
                v: args.amountBuy
              }, {
                t: 'address',
                v: args.tokenSell
              }, {
                t: 'uint256',
                v: args.amountSell
              }, {
                t: 'uint256',
                v: args.expires
              }, {
                t: 'uint256',
                v: args.nonce
              }, {
                t: 'address',
                v: args.address
              });

            var sig = await this.returnSignature(raw, privateKey);

            let obj = {
                tokenBuy: args.tokenBuy,
                amountBuy: args.amountBuy,
                tokenSell: args.tokenSell,
                amountSell: args.amountSell,
                address: _wallet_address,
                nonce: res.nonce,
                expires: args.expires,
                v: sig.v,
                r: sig.r,
                s: sig.s
              };

         console.log("order => ", obj, '\n');
         return await api(`order`,obj)
        },
        trade: async function trade() {
            return await api(`trade`)
        },
         /**
         * Adds two numbers.
         * @param {orderHash} orderHash The first number to add.
         * @param {nonce} nonce The second number to add.
         */
        cancel: async function cancel(orderHash, nonce, privateKey) {

            let raw = web3.soliditySha3({
                t: 'uint256',
                v: orderHash
              }, {
                t: 'uint256',
                v: nonce
              });

            var sig = await this.returnSignature(raw, privateKey);

            const obj = {
                orderHash: orderHash,
                nonce: nonce,
                address: _wallet_address,
                v: sig.v,
                r: sig.r,
                s: sig.s,
              };
            console.log(obj);
            return await api(`cancel`, obj)
        },
        withdraw: async function withdraw() {
            return await api(`withdraw`)
        },
        
        // WebSocket live ticker updates
        subscribe: function subscribe(ticker) {
            const socket = new WebSocket('wss://api-cluster.idex.market');
            socket.on('message', message => console.log(message));

            //ws.on('pong', handleSocketHeartbeat); // Update timer & reconnect zombie sockets

            socket.on('error', error => {
                console.error('WebSocket error: ', error);
                socket.close();
            });

            socket.on('open', () => {
                setInterval(() => socket.ping(), 10000);
                socket.send(JSON.stringify({ subscribe: ticker }), error => {
                    if ( error ) {
                        console.error('WebSocket send error: ', error);
                        socket.close();
                    }
                });
            });
        },
      
        // Convert to sortable array. {"ETHBTC":{}} to [{symbol:"ETHBTC"}]
        obj_to_array: json => {
          let output = [];
          for ( let key in json ) {
            let obj = json[key];
            obj.symbol = key;
            output.push(obj);
          }
          return output;
        }
        
    }
}();