'use strict';
module.exports = (middleware, options) => {

    const UploadHandler = require('./uploadhandler')(options);
    const request = options.server.request;
    const reply = options.server.reply;
    let _headers = new Array();

    _headers['Access-Control-Allow-Origin'] = options.accessControl.allowOrigin;
    _headers['Access-Control-Allow-Methods'] = options.accessControl.allowMethods;

    const handler = new UploadHandler(request, reply, (result, headers, redirect) => {

        if (redirect) {

            const files = { files: result };
            const response = reply();
            response.redirect(redirect.replace(/%s/, encodeURIComponent(JSON.stringify(files))));

        } else {

            _headers['Content-Type'] = (request.raw.req.headers.accept || '').indexOf('application/json') !== -1
                ? 'application/json'
                : 'text/plain';

            const response = reply(result).code(200);
        }

        Object.keys([..._headers, ...headers]).forEach(function (key) {
            response.header(key, headers[key])
        });

    });

    handler.on('begin', fileInfo => {
        middleware.emit('begin', fileInfo, request, reply);
    });

    handler.on('end', fileInfo => {
        middleware.emit('end', fileInfo, request, reply);
    });

    handler.on('abort', fileInfo => {
        middleware.emit('abort', fileInfo, request, reply);
    });

    handler.on('error', e => {
        middleware.emit('abort', e, request, reply);
    });

    handler.on('delete', fileName => {
        middleware.emit('delete', fileName, request, reply);
    });

    switch (request.raw.req.method) {
        case 'OPTIONS':
            request.raw.res.end();
            break;
        case 'HEAD':
        case 'GET':
            handler.get();
            break;
        case 'POST':
            handler.post();
            break;
        case 'DELETE':
            handler.destroy();
            break;
        default:
            reply.code(405);
    }
};
