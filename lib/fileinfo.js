'use strict';
const fs = require('fs'),
    _ = require('lodash');

module.exports = options => {

    class FileInfo {

        constructor(file) {
            this.name = file.name;
            this.originalName = file.name;
            this.size = file.size;
            this.type = file.type;
        }

        validate() {

            if (options.minFileSize && options.minFileSize > this.size) {
                this.error = 'File is too small';

            } else if (options.maxFileSize && options.maxFileSize < this.size) {
                this.error = 'File is too big';

            } else if (!options.acceptFileTypes.test(this.name)) {
                this.error = 'Filetype not allowed';

            }

            return !this.error;
        }

        safeName() {

            // Prevent directory traversal and creating hidden system files:
            this.name = require('path').basename(this.name).replace(/^\.+/, '');

            // Prevent overwriting existing files:
            while (fs.existsSync(`${options.baseDir()}/${this.name}`)) {
                this.name = this.name.replace(/(?:(?: \(([\d]+)\))?(\.[^.]+))?$/, (s, index, ext) => ` (${(parseInt(index, 10) || 0) + 1})${ext || ''}`);
            }
        }

        setUrl(type, baseUrl) {
            const key = type ? `${type}Url` : 'url';
            this[key] = `${baseUrl}/${encodeURIComponent(this.name)}`;
        }
    }

    return FileInfo;
};