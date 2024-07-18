/*
Module to perform iControl API functions

*/
// variables

var https = require('https');
const { XMLParser } = require("fast-xml-parser");

var debug = false
module.exports.debug = debug
/*
Set the tokens object
tokens {
    device.address {
        device.username {
            token: string representing the token
            token_expiry: datetime representing when the token expires
        }
    }
}
To Do - add refresh token support
*/
var tokens = { }
module.exports.tokens = tokens




/*
iControl functions below - request is the general function
used by: list, create, modify,remove
*/
// connect timeout in ms
module.exports.timeout = 5000

/*

Note that device is always an object 
For example:
{ 
    "name": "device-name-1",
    "address": "10.20.30.40",
    "username": "admin",
    "password": "password",
    "type": 1
}

Device types:
Type    Description
0       Non-F5 type
1       BIG-IP
2       BIG-IP Next CM
3       BIG-IP Next Instance
4       F5OS
5       BIG-IQ CM
6       BIG-IQ DCD

*/

request = (device,options={}) => {
    return new Promise (async (resolve,reject) => {
        // First, retrieve device details from device
        if (this.debug) { console.log(`request: Running request with ${JSON.stringify(device)}, options:${JSON.stringify(options)}`) }
        if ( !device.address || !device.username ||!device.password ) {
            reject('Incorrect device details')
            return
        }
        // manage the URL to connect to 
        if ( ! ('url' in options)) {
            if (this.debug) { console.log(`request: options.url is not set`) }
            reject("No url in options")
            return
        }
        if ( ! options.url.startsWith('/') ) { 
            var path = `/mgmt/tm/${options.url}`
        } else {
            var path = options.url
        }
        if (this.debug) { console.log(`request: path is set to ${path}`) }
        // Handle the destination port
        if ( 'port' in options ) {
            var port = options.port
        } else {
            if ( device.type == 3) {
                var port = 5443
            } else {
                var port = 443
            }
        }
        if (this.debug) { console.log(`request: port is set to ${port}`) }
        // handle options by merging
        let headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'f5-api-v1.0'
        }
        // handle method
        if (options.method) {
            var method = options.method
        } else {
            var method = 'GET'
        }
        if (this.debug) { console.log(`request: method is set to ${method}`) }
        // handle data
        if ('data' in options) {
            var body = JSON.stringify(options.data)
            headers['Content-Length'] = body.length
            if (this.debug) { console.log(`request: data is set, length ${body.length}B to ${body}`) }
        }
        // Handle authentication
        /*
        Authentication notes:
            1. BIG-IP/BIG-IQ CM and DCD (device type 1,5 and 6) can use either Basic auth or Token (Token is in X-F5-Auth-Token HTTP header)
            - use POST to /shared/authn/login with username and password as data eg { "username": "admin", "password": "admin" }
            - insert token.token into X-F5-Auth-Token HTTP header
            {
                "username": "admin",
                "loginReference": {
                    "link": "https://localhost/mgmt/cm/system/authn/providers/local/login"
                },
                "loginProviderName": "local",
                "token": {
                    "token": "UKJIC5L7OP7OPFS3LMRTXZKTWZ",
                    "name": "UKJIC5L7OP7OPFS3LMRTXZKTWZ",
                    "userName": "admin",
                    "authProviderName": "local",
                    "user": {
                        "link": "https://localhost/mgmt/shared/authz/users/admin"
                    },
                    "groupReferences": [],
                    "timeout": 1200,
                    "startTime": "2024-07-11T02:22:15.666-0700",
                    "address": "172.18.22.52",
                    "partition": "[All]",
                    "generation": 1,
                    "lastUpdateMicros": 1720689735666487,
                    "expirationMicros": 1720690935666000,
                    "kind": "shared:authz:tokens:authtokenitemstate",
                    "selfLink": "https://localhost/mgmt/shared/authz/tokens/UKJIC5L7OP7OPFS3LMRTXZKTWZ"
                },
                "generation": 0,
                "lastUpdateMicros": 0
            }
            
            https://community.f5.com/kb/technicalarticles/demystifying-icontrol-rest-part-6-token-based-authentication/286793
            
            2. F5OS (device type 4) uses Basic authentication ( sent data is in JSON format and returned data is in YANG/XML format )
            POSTed data:
            {
                "openconfig-vlan:vlan":
                [
                    {
                        "vlan-id":"123",
                        "config":
                        {
                            "vlan-id":123,
                            "name":"vlan-test-2"
                        }
                    }
                ]
            }
            Returned data:
            <vlans xmlns="http://openconfig.net/yang/vlan"  xmlns:oc-vlan="http://openconfig.net/yang/vlan">
                <vlan>
                    <vlan-id>123</vlan-id>
                    <config>
                        <vlan-id>123</vlan-id>
                        <name>vlan-test-2</name>
                    </config>
                </vlan>
            </vlans>

            3. BIG-IP Next CM uses Token auth only and token is in Authorization HTTP header
            - use POST to /api/login with username and password as data eg { "username": "admin", "password": "Admin123!@" }
            BIG-IP Next Node uses port 5443 as the API port - CM uses 443
            CM Returned login response:
            {
                "access_token": "4z7AK45UKoO5p3neS/Q06ryexuU6hR45hSICdrrdxAuUnWGr9Padebtg/Uxcw8M5qLz+UJqe3svxEzWIYJbUZWo4L96M5Z619PPib8ylv+pitrjny4ah6Gcuax+7ISaqN/utlymhk8OCq/IM1WDRx0gGpxOg0DaoK+9jEH8ncOIQicyoUJlEaNy8cvkiMHnZXV20McyxfFXlMKz7D3wuziHJveCVrWSurKHrAw3xl4AbFrMnh54LsZ4rM0uxHDwCHpaeMm9pMjckeOQt6PwO4Zkf1JrejenRN5janyypC0tAf6QXEyqDG+AbkkV26q2Q59JAcMjsO86qDe3wczoot1yoHDvazW/1UCpyHn5StrvN+r62p64LVhXUMacXFqxW59vCZdL7AG0+xhRru3KmoQuPQvaOQz8L/MjmHTUnJM6+DFZkMZaxh65nlBPTyOAPsWCic2+DjpCkUUgDbtbpJX00q6nU+cBXxm5nUHqvsu9MWmfqf1IS9si4NWu/Cyn0jw9i8xRQZ34HSrbpche+bezNO+K2MoJma5yPhbDIKA==",
                
                "refresh_token": "4z7AK45UKoO5p3neS/Q06ryexuU6hR45hSICdrrdxAuUnWGr9Padebtg/Uxcw8M5qLz+UJqe3svxEzWIYJbUZWo4L96M5Z619PPib8ylv+pitrjny4ah0igtay27ISaqN/utlymhk8OCq/IM1WDRx0gGpxOg0DaoK+9jEH8ncOIQicyoUJlEaNy8cvkiMHnZXV20McyxfFXlMKz7D3wuziHJveCVrWSurKHrAw3xl4AUAZovhIk1vZ0/M0u1HhIoH5aeMTZpDzckbsky/Ooe4ZkL15qVjNTNdJiClyqpNU9Af6QXEyqDG+AbkkV26q2Q59JAcMjsO86qDe3wczoot1yoHDvazW/1UCpyHn5StrvN+r62p64LVhXUMacXFqxW59vCZdL7AG0+xhRru3KmoQuPQvaOQz8L/LOZRHY5Wbf0LzleMpze6ql411+84rkToBuOU2fSgKCYe0A+M+HpRVhD2b7d0JhowTZVNHbxjvt5ZCvmaDw67cy7HU2AHh2Oiiwv+3RUegMbWIG2cnKu82+oHKECvItQkqfSERXnIA==",
                
                "user_id": "f7de1017-5528-4a74-a2ad-f9b7a51df36e"
            }
            Node Returned login response:
            {
                "token": "eyJhbGciOiJIUzM4NCIsImtpZCI6ImMyMGZlMTM3LTU3NGUtNGQwNy1iYzQ4LWE0ZjVlYjBiNmRjZiIsInR5cCI6IkpXVCJ9.eyJFeHRlbnNpb25zIjp7IngtZjUtdXNlci1wYXNzLWNoYW5nZSI6WyJubyJdLCJ4LWY1LXVzZXItcm9sZSI6WyJhZG1pbmlzdHJhdG9yIl0sIngtZjUtdXNlci1zdGF0dXMiOlsiZW5hYmxlZCJdLCJ4LWY1LXVzZXItc3RyYXRlZ3kiOlsibG9jYWwiXX0sIkdyb3VwcyI6bnVsbCwiSUQiOiIyY2NhYTY1MC1kOWNkLTRjYzYtYWVhNS0zMWFkNzJjNjgzYmIiLCJOYW1lIjoiYWRtaW4iLCJhdWQiOlsiIl0sImV4cCI6MTY2NTYxNTEyMSwiaWF0IjoxNjY1NjExNTIxLCJuYmYiOjE2NjU2MTE1MjEsInN1YiI6IjJjY2FhNjUwLWQ5Y2QtNGNjNi1hZWE1LTMxYWQ3MmM2ODNiYiJ9.O60pllWhDyvex_J-G3c_6HbcIjxrohgO8y_mDNQJNpJX8wEEhT-dnrPBGJaxiARt",
                "tokenType": "Bearer",
                "expiresIn": 3600,
                "refreshToken": "NDEzZjRmYmEtZjMwMy00ZTczLTlmYTktYTJmMjZhNzZiNWI1OqLGD1RC7P4SDIxLwwdlPQfHJl/VcsILfAVoyVZOrCgpGYHl0ZJbbPDnkcPpA9AK6g",
                "refreshExpiresIn": 1209600,
                "refreshEndDate": "2023-01-10T21:53:01Z"
            }

            
            Next CM:    https://clouddocs.f5.com/bigip-next/latest/use_cm/cm_api_auth.html
                        https://clouddocs.f5.com/products/bigip-next/mgmt-api/latest/ApiReferences/bigip_public_api_ref/r_openapi-next.html#tag/API-Gateway/operation/UserLogin
            
            Next Node:  https://my.f5.com/manage/s/article/K000092443

        */
        if (this.debug) { console.log(`request: handling authentication...`) }
        if ( 'authentication' in options) {
            if ( options.authentication == undefined ) {
                // Do not insert any auth headers
            } else if ( options.authentication == 'token' ) {
                // Retrieve a token and insert
                try {
                    if (this.debug) { console.log(`request: authentication is set to token, running get_token()`) }
                    let token = await get_token(device)
                    if (this.debug) { console.log(`request: Retrieved token for ${device.name}: ${token}, inserting`) }
                    // insert token according to device type
                    if (device.type == 1||device.type == 5||device.type == 6) {
                        if (this.debug) { console.log(`request: Device type is BIG-IP/IQ, inserting X-F5-Auth-Token`) }
                        headers['X-F5-Auth-Token'] = token
                    } else if (device.type == 2||device.type == 3) {
                        if (this.debug) { console.log(`request: Device type is Next, inserting Authorization header`) }
                        headers['Authorization'] = `Bearer ${token}`
                    } else {
                        reject(`request: Device type is ${device.type} which does not use token auth`)
                    }
                } catch (err) {
                    console.log(`request: There was an error retrieving token:${err}`,'error')
                    reject(err)
                    return
                }
            } else if ( options.authentication == 'basic' ) {
                // Basic auth
                let encoded = Buffer.from([device.username, device.password].join(':'), 'utf8').toString('base64')
                if (this.debug) { console.log(`request: authentication is set to Basic authentication: ${encoded}`) }
                headers['Authorization'] = `Basic ${encoded}`
            } else {
                reject(`request: options.authentication is set invalid value: ${options.authentication}`)
                return
            }
        } else {
            // Basic auth
            let encoded = Buffer.from([device.username, device.password].join(':'), 'utf8').toString('base64')
            if (this.debug) { console.log(`request: authentication is not set, assuming Basic authentication: ${encoded}`) }
            headers['Authorization'] = `Basic ${encoded}`
        }
        
        let o = {
            hostname: device.address,
            port: port,
            path: path,
            method: method,
            headers: headers,
            rejectUnauthorized: false,
        }
        if (this.debug) { console.log(`request: sending https.request with options ${JSON.stringify(o)}`) }
        let timeout = this.timeout
        if (this.debug) { console.log(`request: setting timeout to ${JSON.stringify(timeout)}`) }
        let req = https.request (o, (resp) => {
            setTimeout(() => {
                req.destroy();
              }, timeout);
            if (resp.statusCode != 200) { reject(`iControl non-200 status code:${resp.statusCode}`) }
            let data = '';
            resp.on('data', (chunk) => {
                data = data + chunk.toString();
            });
            resp.on('end', () => {
                const headers = resp.headers;
                try{
                    if ( 'content-type' in headers ) {
                        const contentType = headers['content-type']
                        if ( contentType.includes('json')) {
                            // parse JSON
                            let d = JSON.parse(data);
                            if (this.debug) { console.log(`request: returning data ${JSON.stringify(d)} from JSON ${data}`) }
                            resolve(d)
                        } else if (contentType.includes('xml')) {
                            // parse XML
                            const xml_parser = new XMLParser();
                            let d = xml_parser.parse(data)
                            if (this.debug) { console.log(`request: returning data ${JSON.stringify(d)} from XML ${data}`) }
                            resolve(d)
                        }
                    } else {
                        // No content-type, so just return data
                        resolve(data)
                    }
                } catch (err) {
                    reject(`Error in parsing data:${err}`)
                }
                return
            });
            resp.on('close',() => {
                req.destroy()
                resolve("Connection closed")
                return
            })
        });
        req.on('timeout',(error) => {
            req.destroy()
            if (this.debug) {console.log("request: Connection timeout",'error') }
            reject("Connection timeout")
            return
        })
        req.on('error', (error) => {
            req.destroy()
            if (error.code == "ECONNRESET") {
                if (this.debug) {console.log("request: Connection timeout",'error')}
                reject("Connection timeout")
            } else {
                if (this.debug) {console.log(`request: Error caught:${error.message}`,'error')}
            reject(error.message)
            return
            }            
        });
        if ( 'data' in options ) { 
            req.write(body) 
        }
        req.end();
    }); 
}
get_token = (device) => {
    return new Promise (async (resolve,reject) => {
        if (this.debug) { console.log(`get_token: tokens: ${JSON.stringify(this.tokens)}`) }
        // First, check whether there is a valid token already available
        if (    (this.tokens !== undefined) &&
                (device.address in this.tokens) &&
                (device.username in this.tokens[device.address])) {
                    if (this.debug) { console.log(`get_token: token is valid, using token:${this.tokens[device.address][device.username].token}`) }
                    resolve(this.tokens[device.address][device.username].token)
                    return
                }
        if (this.debug) { console.log(`get_token: No valid tokens found:${JSON.stringify(this.tokens)}, retrieving a token`) }
        // No valid tokens found, retrieve a token
        let options = {}
        if (device.type == 1 || device.type == 5 || device.type == 6 ) {
            // BIG-IP, BIG-IQ CM or BIG-IQ DCD
            options = { url: "/mgmt/shared/authn/login",
                authentication: undefined,
                method:"POST",
                data: {     "username": device.username,
                            "password": device.password,
                            "loginProviderName": "tmos"
                }
            }
        } else if (device.type == 2) {
            // Next CM
            options = { url: "/api/login",
                authentication: undefined,
                method:"POST",
                data: {     "username": device.username,
                            "password": device.password,
                            "provider_type": "Local"
                }
            }
        } else if (device.type == 3) {
            // Next Node
            options = { url: "/api/v1/login",
                authentication: 'basic',
                method:"GET"
            }
        } else if (device.type == 4) {
            // F5OS - this uses basic auth
            reject("F5OS uses basic authentication. Set options.authentication to 'basic'")
        } 
        if (this.debug) { console.log(`get_token: Calling request with options ${JSON.stringify(options)}`) }
        try {
            let response = await request(device,options)
            if (response === undefined) {reject("undefined response from device - unreachable?")}
            if (this.debug) { console.log(`get_token: Received response:${JSON.stringify(response)}`) }
            // Return the correct token details

             // First, prepare the tokens object
            if ( ! (device.address in this.tokens) ) {
                this.tokens[device.address] = {}
            }
            if ( ! (device.username in this.tokens[device.address]) ) {
                this.tokens[device.address][device.username] = { "token": undefined, "token_expiry": undefined }
            }
            // Check the response and extract the token
            if (device.type == 1 || device.type == 5 || device.type == 6 ) {
                // BIG-IP
                if (this.debug) { console.log(`get_token: Device type ${device.type}. Received response:${JSON.stringify(response)}`) }
                if (    'token' in response && 
                        'token' in response.token && 
                        response.token.token != "") {
                    if (this.debug) { console.log(`get_token: Token found in response:${response['token']['token']}`) }
                    this.tokens[device.address][device.username]['token'] = response.token.token
                    if ('timeout' in response['token']) {
                        this.tokens[device.address][device.username]['token_expiry'] = Date.now() + response.token.timeout
                        if (this.debug) { console.log(`get_token: Timeout found in response:${response.token.timeout}`) }
                    } else {
                        if (this.debug) { console.log(`get_token: Cannot find timeout in response:${JSON.stringify(response.token)}`) }
                        this.tokens[device.address][device.username]['token_expiry'] = Date.now() + 1200
                    }
                    if (this.debug) { console.log(`get_token: Tokens object after addition:${JSON.stringify(this.tokens)}`) }
                    resolve(response.token.token)
                } else {
                    reject('No token received')
                }
            } else if (device.type == 2) {
                if (this.debug) { console.log(`get_token: Device type ${device.type}. Received response:${JSON.stringify(response)}`) }
                if ('access_token' in response && response.access_token != "" ) {
                    if (this.debug) { console.log(`get_token: Setting token to :${response.access_token}`) }
                    this.tokens[device.address][device.username]['token'] = response.access_token
                    this.tokens[device.address][device.username]['token_expiry'] = Date().now + 300
                }
                if ('refresh_token' in response && response.refresh_token != "" ) {
                    if (this.debug) { console.log(`get_token: Setting refresh_token to :${response.refresh_token}`) }
                    this.tokens[device.address][device.username]['refresh_token'] = response.refresh_token
                    this.tokens[device.address][device.username]['refresh_expiry'] = Date().now + 1200
                }
            }
        } catch (err) {
            console.log(`get_token: error when retrieving token: ${err}`,'error')
        }
    });
}

module.exports.list = async (device,options) => {
    if (this.debug) { console.log(`Running list with options:${JSON.stringify(options)}`) }
    if ( ! ('authentication' in options) && (device.type == 2||device.type == 3) ) {
        // set the default Next authentication to be token
        if (this.debug) { console.log(`Authentication is not set, and device type is ${device.type}, setting options.authentication to 'token'`) }
        options.authentication = 'token'
    }
    return await request(device,options)
};

module.exports.show = async (device,options) => {
    if (this.debug) { console.log(`Running show with options:${JSON.stringify(options)}`) }
    options.url = `${options.url}/stats`
    if ( ! ('authentication' in options) && (device.type == 2||device.type == 3) ) {
        // set the default Next authentication to be token
        if (this.debug) { console.log(`Authentication is not set, and device type is ${device.type}, setting options.authentication to 'token'`) }
        options.authentication = 'token'
    }
    return await request(device,options)
};

module.exports.create = async (device,options) => {
    console.log(`Running create with options:${JSON.stringify(options)}`)
    if ( ! ('authentication' in options) && (device.type == 2||device.type == 3) ) {
        // set the default Next authentication to be token
        if (this.debug) { console.log(`Authentication is not set, and device type is ${device.type}, setting options.authentication to 'token'`) }
        options.authentication = 'token'
    }
    options.method = 'POST'
    return await request(device,options)
};

module.exports.modify = async (device,options) => {
    if (this.debug) { console.log(`Running modify with options:${JSON.stringify(options)}`) }
    if ( ! ('authentication' in options) && (device.type == 2||device.type == 3) ) {
        // set the default Next authentication to be token
        if (this.debug) { console.log(`Authentication is not set, and device type is ${device.type}, setting options.authentication to 'token'`) }
        options.authentication = 'token'
    }
    options.method = 'PUT'
    return await request(device,options)
};

module.exports.delete = async (device,options) => {
    if (this.debug) { console.log(`Running delete with options:${JSON.stringify(options)}`) }
    if ( ! ('authentication' in options) && (device.type == 2||device.type == 3) ) {
        // set the default Next authentication to be token
        if (this.debug) { console.log(`Authentication is not set, and device type is ${device.type}, setting options.authentication to 'token'`) }
        options.authentication = 'token'
    }
    options.method = 'DELETE'
    return await request(device,options)
};

module.exports.command = async (device,command) => {
    // this is only viable for BIG-IP/IQ devices
    if ( device.type != 1 && device.type != 5 && device.type != 6 ) {
        if (this.debug) { console.log(`command is not valid for device type ${device.type}`) }
        return false
    }
    let options = {
        'method': 'POST',
        'url': "util/bash",
        'data': { "command": "run", "utilCmdArgs": "-c '" + command + "'" }
    }
    if (this.debug) { console.log(`Running command ${command}`) }
    response = await request(device,options)
    if (this.debug) { console.log(`command response ${response}`) }
    if ( response && "commandResult" in response) {
        return response["commandResult"]
    } else {
        return false
    }
};

module.exports.tmsh = async (device,c) => {
    if (this.debug) { console.log(`Running tmsh ${c}`) }
    return this.command(device,`/bin/tmsh -q ${c}`)
};
