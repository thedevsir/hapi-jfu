'use strict';
const EventEmitter = require('events').EventEmitter,
    path = require('path'),
    fs = require('fs'),
    formidable = require('formidable'),
    imageMagick = require('imagemagick'),
    mkdirp = require('mkdirp'),
    _ = require('lodash'),
    async = require('async');

module.exports = options => {

    const FileInfo = require('./fileinfo')(
        _.extend({
            baseDir: options.uploadDir
        }, _.pick(options, 'minFileSize', 'maxFileSize', 'acceptFileTypes'))
    );

    class UploadHandler {

        constructor(request, reply, callback) {
            EventEmitter.call(this);
            this.request = request;
            this.reply = reply;
            this.callback = callback;
            this.headers = new Array();
        }

        noCache() {

            this.headers['Pragma'] = 'no-cache';
            this.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';

            if ((this.request.raw.req.headers.accept || "").includes("application/json")) {

                this.headers['Content-Type'] = 'application/json';
                this.headers['Content-Disposition'] = 'inline; filename="files.json"';

            } else {
                this.headers['Content-Type'] = 'text/plain';
            }

        }

        get() {
            this.noCache();
            const files = [];
            fs.readdir(options.uploadDir(), _.bind(function (err, list) {
                async.each(list, _.bind(function (name, cb) {
                    fs.stat(`${options.uploadDir()}/${name}`, _.bind(function (err, stats) {
                        if (!err && stats.isFile()) {
                            const fileInfo = new FileInfo({
                                name,
                                size: stats.size
                            });
                            this.initUrls(fileInfo, err => {
                                files.push(fileInfo);
                                cb(err);
                            });
                        }
                        else cb(err);
                    }, this));
                }, this),
                    _.bind(function (err) {
                        this.callback({ files }, self.headers);
                    }, this));
            }, this));
        };

        post() {

            const self = this;
            const form = new formidable.IncomingForm();
            const tmpFiles = [];
            const files = [];
            const map = {};
            let counter = 1;
            let redirect;

            const finish = _.bind(function () {

                if (!--counter) {
                    async.each(files, _.bind(function (fileInfo, cb) {

                        this.initUrls(fileInfo, _.bind(function (err) {
                            this.emit('end', fileInfo);
                            cb(err);
                        }, this));

                    }, this),

                        _.bind(function (err) {
                            this.callback({ files }, self.headers, redirect);
                        }, this));
                }
            }, this);

            this.noCache();

            form.uploadDir = options.tmpDir;
            form
                .on('fileBegin', (name, file) => {
                    tmpFiles.push(file.path);
                    const fileInfo = new FileInfo(file);

                    fileInfo.safeName();
                    map[path.basename(file.path)] = fileInfo;
                    files.push(fileInfo);

                    self.emit('begin', fileInfo);
                })
                .on('field', (name, value) => {

                    if (name === 'redirect') {
                        redirect = value;
                    }

                    if (!self.request.fields)
                        self.request.fields = {};

                    self.request.fields[name] = value;
                })
                .on('file', (name, file) => {

                    counter++;
                    const fileInfo = map[path.basename(file.path)];

                    fs.exists(file.path, exists => {

                        if (exists) {
                            fileInfo.size = file.size;
                            if (!fileInfo.validate()) {
                                fs.unlink(file.path);
                                finish();
                                return;
                            }

                            const generatePreviews = () => {
                                if (options.imageTypes.test(fileInfo.name)) {
                                    _.each(options.imageVersions, (value, version) => {
                                        counter++;
                                        // creating directory recursive
                                        mkdirp(`${options.uploadDir()}/${version}/`, (err, made) => {
                                            const opts = options.imageVersions[version];
                                            imageMagick.resize({
                                                width: opts.width,
                                                height: opts.height,
                                                srcPath: `${options.uploadDir()}/${fileInfo.name}`,
                                                dstPath: `${options.uploadDir()}/${version}/${fileInfo.name}`,
                                                customArgs: opts.imageArgs || ['-auto-orient']
                                            }, finish);
                                        });
                                    });
                                }
                            };

                            mkdirp(`${options.uploadDir()}/`, (err, made) => {

                                fs.rename(file.path, `${options.uploadDir()}/${fileInfo.name}`, err => {

                                    if (!err) {
                                        generatePreviews();
                                        finish();
                                    } else {

                                        const is = fs.createReadStream(file.path);
                                        const os = fs.createWriteStream(`${options.uploadDir()}/${fileInfo.name}`);

                                        is.on('end', err => {

                                            if (!err) {
                                                fs.unlink(file.path);
                                                generatePreviews();
                                            }

                                            finish();
                                        });

                                        is.pipe(os);
                                    }
                                });
                            });
                        }
                        else finish();
                    });
                })
                .on('aborted', () => {

                    _.each(tmpFiles, file => {

                        const fileInfo = map[path.basename(file)];
                        self.emit('abort', fileInfo);

                        fs.unlink(file);
                    });

                })
                .on('error', e => {
                    self.emit('error', e);
                })
                .on('progress', (bytesReceived, bytesExpected) => {

                    if (bytesReceived > options.maxPostSize)
                        self.request.raw.req.connection.destroy();

                })
                .on('end', finish)
                .parse(self.request.raw.req);
        }

        destroy() {

            const self = this;
            const fileName = path.basename(decodeURIComponent(this.request.raw.req.url));

            const filepath = path.join(options.uploadDir(), fileName);

            if (filepath.indexOf(options.uploadDir()) !== 0) {
                self.emit('delete', fileName);
                self.callback({ success: false });
                return;
            }

            fs.unlink(filepath, ex => {

                _.each(options.imageVersions, (value, version) => {
                    fs.unlink(path.join(options.uploadDir(), version, fileName));
                });

                self.emit('delete', fileName);
                self.callback({ success: !ex });
            });
        }

        initUrls(fileInfo, cb) {

            const baseUrl = `${options.ssl ? 'https:' : 'http:'}//${options.hostname || this.request.info.host || `${this.request.connection.info.host}:${this.request.connection.info.port}`}`;

            fileInfo.setUrl(null, baseUrl + options.uploadUrl());
            fileInfo.setUrl('delete', baseUrl + this.request.raw.req.originalUrl);

            async.each(Object.keys(options.imageVersions), (version, cb) => {

                fs.exists(`${options.uploadDir()}/${version}/${fileInfo.name}`, exists => {
                    if (exists) fileInfo.setUrl(version, `${baseUrl + options.uploadUrl()}/${version}`);
                    cb(null);
                })

            },
                cb);
        }
    }

    require('util').inherits(UploadHandler, EventEmitter);

    return UploadHandler;
};