# hapi-jfu

jQuery-File-Upload Hapi.js Middleware

[![Dependency Status](https://david-dm.org/tavousi/hapi-jfu.svg)](https://david-dm.org/tavousi/hapi-jfu)
[![devDependency Status](https://david-dm.org/tavousi/hapi-jfu/dev-status.svg?theme=shields.io)](https://david-dm.org/tavousi/hapi-jfu?type=dev)
[![Build Status](https://travis-ci.org/tavousi/hapi-jfu.svg?branch=master)](https://travis-ci.org/tavousi/hapi-jfu)

jQuery-File-Upload Hapi.js Middleware. Based on the server code of [jQuery-File-Upload](https://github.com/blueimp/jQuery-File-Upload)

Installation:

```
    $ npm install hapi-jfu --save
```

Usage:

```javascript
    server.route({
        method: 'POST',
        path: '/',
        config: {
            tags: ['api'],
            payload: {
                maxBytes: 209715200,
                output: 'stream',
                parse: false
            }
        },
        handler: function (request, reply) {

            const upload = request.server.plugins['storage/image'].jfu;

            upload.configure({
                uploadDir: './public/storage',
                uploadUrl: './storage',
                imageVersions: {
                    thumbnail: {
                        width: 80,
                        height: 80
                    }
                },
                server: {
                    request: request,
                    reply: reply
                }
            });

            upload.fileHandler();
        }
    });

```

Important : always need to configure payload in route with two parameter output and parse addition you should always pass request and reply parameter like above in configuration too .

On the frontend:

```html
   <input id="fileupload" type="file" name="files[]" data-url="/upload" multiple>
   <script>$('#fileupload').fileupload({ dataType: 'json' })</script>
```

Other options and their default values:

```javascript
{
    tmpDir: '/tmp',
    uploadDir: __dirname + '/public/uploads',
    uploadUrl: '/uploads',
    targetDir: uploadDir,
    targetUrl: uploadUrl,
    ssl: false,
    hostname: null, // in case your reverse proxy doesn't set Host header
                    // eg 'google.com'
    maxPostSize: 11000000000, // 11 GB
    minFileSize: 1,
    maxFileSize: 10000000000, // 10 GB
    acceptFileTypes: /.+/i,
    imageTypes: /\.(gif|jpe?g|png)$/i,
    imageVersions: {
        thumbnail: {
            width: 80,
            height: 80
        }
    },
    imageArgs: ['-auto-orient'],
    accessControl: {
        allowOrigin: '*',
        allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE'
    }
}
```

## Forked from
[jquery-file-upload-middleware](https://github.com/aguidrevitch/jquery-file-upload-middleware/)

## License
Copyright (c) 2017 [Amirhossein Tavousi]
Released under the [MIT license](http://www.opensource.org/licenses/MIT).
