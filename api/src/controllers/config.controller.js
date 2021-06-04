const fs = require('fs');
const config = require('../constants/config');
const { respond, HTTPSuccess /* , HTTPError */ } = require('../util/respond.util');
const { OK } = require('../constants/http-status');

module.exports.get = async (req, res) => {
  try {
    const { format } = req.query;
    const output =
      format === 'yaml' ? fs.readFileSync(`${__dirname}/../../../config.yml`, 'utf8') : config();
    res.status(OK).json(output);
  } catch (error) {
    respond(error, res);
  }
};

module.exports.patch = async (req, res) => {
  try {
    const { code } = req.body;
    fs.writeFileSync(`${__dirname}/../../../config.yml`, code);
    respond(HTTPSuccess(OK, req.body), res);
  } catch (error) {
    respond(error, res);
  }
};
