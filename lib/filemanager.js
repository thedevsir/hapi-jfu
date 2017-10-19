'use strict';
const _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    mkdirp = require('mkdirp');

module.exports = (middleware, options) => {

    options = _.extend({
        targetDir() {
            return options.uploadDir();
        },
        targetUrl() {
            return options.uploadUrl();
        }
    }, options);

    _.each(['targetDir', 'targetUrl'], key => {
        if (!_.isFunction(options[key])) {
            const originalValue = options[key];
            options[key] = () => originalValue;
        }
    });

    class FileManager {

        getFiles(callback) {

            const files = {};
            let counter = 1;
            const finish = () => {
                if (!--counter)
                    callback(files);
            };

            fs.readdir(options.uploadDir(), _.bind(function (err, list) {
                _.each(list, name => {
                    const stats = fs.statSync(`${options.uploadDir()}/${name}`);
                    if (stats.isFile()) {
                        files[name] = {
                            path: `${options.uploadDir()}/${name}`
                        };
                        _.each(options.imageVersions, (value, version) => {
                            counter++;
                            fs.exists(`${options.uploadDir()}/${version}/${name}`, exists => {
                                if (exists)
                                    files[name][version] = `${options.uploadDir()}/${version}/${name}`;
                                finish();
                            });
                        });
                    }
                }, this);
                finish();
            }, this));
        }

        move(filename, targetDir, callback) {

            let targetUrl;

            // for safety
            filename = path.basename(filename).replace(/^\.+/, '');

            if (!targetDir.match(/^\//)) {
                targetUrl = `${options.targetUrl()}/${targetDir}`;
                targetDir = `${options.targetDir()}/${targetDir}`;
                relative = true;
            }

            fs.stat(`${options.uploadDir()}/${filename}`, (err, stat) => {
                if (!err) {
                    if (stat.isFile()) {
                        move(`${options.uploadDir()}/${filename}`, targetDir, (err, safename) => {
                            if (err) {
                                callback(err);
                            } else {
                                const urls = {
                                    filename: safename
                                };

                                let counter = 1;
                                const finish = err => {
                                    if (err)
                                        counter = 1;
                                    if (!--counter)
                                        callback(err, err ? null : urls);
                                };

                                if (targetUrl)
                                    urls.url = `${targetUrl}/${safename}`;

                                _.each(options.imageVersions, (value, version) => {
                                    counter++;
                                    fs.exists(`${options.uploadDir()}/${version}/${filename}`, exists => {
                                        if (exists) {
                                            move(`${options.uploadDir()}/${version}/${filename}`, `${targetDir}/${version}/`, (err, safename) => {
                                                if (!err && relative)
                                                    urls[`${version}Url`] = `${targetUrl}/${version}/${safename}`;
                                                finish(err);
                                            });
                                        }
                                    });
                                });
                                finish();
                            }
                        });
                    } else {
                        callback(new Error('File not found'));
                    }
                } else {
                    callback(err);
                }
            });
        }
    }

    const safeName = (dir, filename, callback) => {
        fs.exists(`${dir}/${filename}`, exists => {
            if (exists) {
                filename = filename.replace(/(?:(?: \(([\d]+)\))?(\.[^.]+))?$/, (s, index, ext) => ` (${(parseInt(index, 10) || 0) + 1})${ext || ''}`);
                safeName(dir, filename, callback)
            } else {
                callback(filename);
            }
        });
    };

    const moveFile = (source, target, callback) => {
        fs.rename(source, target, err => {
            if (!err)
                callback();
            else {
                const is = fs.createReadStream(source);
                const os = fs.createWriteStream(target);
                is.on('end', err => {
                    if (!err) {
                        fs.unlink(source, callback);
                    } else {
                        callback(err);
                    }
                });
                is.pipe(os);
            }
        });
    };

    var move = (source, targetDir, callback) => {
        fs.exists(targetDir, exists => {
            if (!exists) {
                mkdirp(targetDir, err => {
                    if (err)
                        callback(err);
                    else
                        move(source, targetDir, callback);
                });
            } else {
                fs.stat(source, (err, stat) => {
                    if (!err) {
                        if (stat.isFile()) {
                            safeName(targetDir, path.basename(source), safename => {
                                moveFile(source, `${targetDir}/${safename}`, err => {
                                    callback(err, safename);
                                });
                            });
                        } else {
                            callback(new Error(`${source} is not a file`));
                        }
                    } else {
                        callback(err);
                    }
                });
            }
        });
    };

    return new FileManager();
};