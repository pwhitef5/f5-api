# f5-api

## Purpose

This Node.js module is used to connect to the F5 device API - this supports BIG-IP, BIG-IP Next (CM and instance), F5OS, BIG-IQ (CM and DCD) and also non-F5 devices.

## Getting started

Include the module in your code:

```javascript
var api = require('f5-api');
```

Then create a BIG-IP device to connect to:

```javascript
var device = {
    "name": "test-bigip-1",
    "address": "10.155.255.26",
    "username": "admin",
    "password": "admin",
    "type": 1
}
```

And either create an options object with url and send this to the function, or specify it directly:
Example:

```javascript
var options = {
    "url": "ltm/virtual"
}
api.list(device,options).then((vs_list) => { 
    // do stuff here
})
```

or pass the url directly:

```javascript
api.list(device,{ "url": "ltm/virtual"}).then((vs_list) => { 
    // do stuff here
})
```

### Device Types

The following device types are available:

| Type    | Description            |
| ------- | ---------------------- |
| 0       | Non-F5 type |
| 1       | BIG-IP |
| 2       | BIG-IP Next CM |
| 3       | BIG-IP Next Instance |
| 4       | F5OS |
| 5       | BIG-IQ CM |
| 6       | BIG-IQ DCD |

### URL formatting

If the URL has a leading / eg /mgmt/tm/ltm/virtual then it will be treated as complete. If not eg ltm/virtual then the appropriate prefix will be added eg /mgmt/tm/ltm/virtual

## Functions

There are functions available as per the BIG-IP `tmsh` syntax:

- `list`
- `show`
- `create`
- `modify`
- `delete`
For the functions above, the device and options objects will be provided, and returned data will be the return object ( or error )

- `command` - for this function, the device object and the command string are provided eg 'ls -l /var/tmp'
- `tmsh` - for this function, the device object and the tmsh string are provided eg 'list ltm profile tcp'