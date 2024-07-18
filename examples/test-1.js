var api = require('./index.js');
var device = {
    "name": "test-bigip-1",
    "address": "10.155.255.26",
    "username": "admin",
    "password": "admin",
    "type": 1
}
var options = {
    "url": "ltm/virtual"
}
api.list(device,options)
    .then((vs_list) => {
        //console.log(`vs_list:${JSON.stringify(vs_list)}`)
        if ('items' in vs_list) {
            vs_list.items.forEach((vs) => {
                console.log(`Virtual Server ${vs.name}\n: ${JSON.stringify(vs)}\n`)
                if ('poolReference' in vs) {
                    // remove the https://localhost from the selflink
                    let pool_link = vs.poolReference.link.slice(17)
                    // Grab the pool config
                    api.list(device, { "url": pool_link })
                        .then((pool) => {
                            console.log(`Pool ${pool.name}: ${JSON.stringify(pool)}\n`)
                        })
                        .catch((error) => {
                            console.error("Pool list error:"+error)
                        })
                }
            })
        }
    })
    .catch((error) => {
        console.error("VS list error:"+error)
    })