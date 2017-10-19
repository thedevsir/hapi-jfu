'use strict';
const _ = require('lodash'),
    EventEmitter = require('events').EventEmitter,
    os = require("os");

class JqueryFileUploadMiddleware {

    constructor(options) {
        EventEmitter.call(this);
        // setting default options
        this.options = this.prepareOptions(_.extend({}, options));
    }

    prepareOptions(options) {

        options = _.extend({
            tmpDir: os.tmpdir(),
            uploadDir: `${__dirname}/public/storage`,
            uploadUrl: '/storage/',
            maxPostSize: 5000000, // 5MB
            minFileSize: 1,
            maxFileSize: 1000000, // 1 MB
            acceptFileTypes: /\.(gif|jpe?g|png)$/i,
            imageTypes: /\.(gif|jpe?g|png)$/i,
            imageVersions: {
                // thumbnail: {
                //     width: 80,
                //     height: 80
                // }
            },
            accessControl: {
                allowOrigin: '*',
                allowMethods: 'OPTIONS, HEAD, GET, POST, PUT, DELETE'
            }
        }, options);

        _.each(['uploadDir', 'uploadUrl'], key => {

            if (!_.isFunction(options[key])) {
                const originalValue = options[key];
                options[key] = () => originalValue;
            }

        });

        return options;
    }

    configure(options) {
        this.options = this.prepareOptions(options);
    }

    fileHandler(options) {
        return require('./lib/filehandler')(this, this.prepareOptions(_.extend(this.options, options)));
    }

    fileManager(options) {
        return require('./lib/filemanager')(this, this.prepareOptions(_.extend(this.options, options)));
    }
}

require('util').inherits(JqueryFileUploadMiddleware, EventEmitter);

exports.register = function (server, options, next) {

    server.expose('jfu', new JqueryFileUploadMiddleware(options));

    next();
};

exports.register.attributes = {
    name: 'hapi-jfu',
    version: '1.0.0'
};
