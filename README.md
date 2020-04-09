# obniz WebApp Server Software Example for Install

This project show how to use obniz oauth and GraphQL API.

WebApp Install model let you create database-less webservice for IoT Projects.

## How to run

install and start

### Create WebApp

create WebApp on obniz.io and generate WebApp Token.

### Authorize and Install

Authorize Your App on obniz.io and Install App.

### Start nodejs

Specify env

- TOKEN: Your WebApp Token

```
npm i
TOKEN=apptoken_ABCDEFG npm start
```

It will retrive your Installed app information via API

### WebHook

obniz.io will notify user's install/update/uninstall of your WebApp by using Webhook.
Configure your url on WebApp Configration.


## Code

[./dist/src/index.js](./dist/src/index.js)