'use strict';
/**
 * Check uri
 */
exports.checkUri = (s) => {
    let r = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/;
    return r.test(s);
};
