const { promisify } = require('util');
const fs = require('fs');
const sharp = require('sharp');
const sizeOf = promisify(require('image-size'));
const database = require('../util/db.util');
const filesystem = require('../util/fs.util');
const { respond, HTTPSuccess /* , HTTPError */ } = require('../util/respond.util');
const { OK } = require('../constants/http-status');
const { STORAGE } = require('../constants');

let matchProps = [];

module.exports.get = async (req, res) => {
  try {
    const { sinceId } = req.query;

    const db = database.connect();
    let matches = db
      .prepare(
        `
          SELECT * FROM match
          WHERE filename NOT IN (SELECT filename FROM train)
          AND id > ?
          ORDER BY createdAt DESC LIMIT 100
        `
      )
      .bind(sinceId || 0)
      .all();

    matches = await Promise.all(
      matches.map(async (obj) => {
        const { id, filename, event, response } = obj;
        const { camera, type, zones } = JSON.parse(event);

        const key = `matches/${filename}`;

        const output = {
          id,
          camera,
          type,
          zones,
          file: {
            key,
            filename,
          },
          response: JSON.parse(response),
          createdAt: obj.createdAt,
        };

        const [matchProp] = matchProps.filter((prop) => prop.key === key);

        if (matchProp) {
          output.file = matchProp.file;
        } else if (fs.existsSync(`${STORAGE.PATH}/${key}`)) {
          const base64 = await sharp(`${STORAGE.PATH}/${key}`).resize(500).toBuffer();
          const { width, height } = await sizeOf(`${STORAGE.PATH}/${key}`);
          output.file.base64 = base64.toString('base64');
          output.file.width = width;
          output.file.height = height;
          // push sharp and sizeOf results to an array to search against
          matchProps.unshift({ key, file: output.file });
        }

        return output;
      })
    );
    matches = matches.flat();
    matchProps = matchProps.slice(0, 500);

    respond(HTTPSuccess(OK, { matches }), res);
  } catch (error) {
    respond(error, res);
  }
};

module.exports.patch = async (req, res) => {
  try {
    const { folder, matches } = req.body;
    matches.forEach((obj) => {
      filesystem.move(
        `${STORAGE.PATH}/${obj.key}`,
        `${STORAGE.PATH}/train/${folder}/${obj.filename}`
      );
    });
    respond(HTTPSuccess(OK, { sucess: true }), res);
  } catch (error) {
    respond(error, res);
  }
};

module.exports.delete = async (req, res) => {
  try {
    const files = req.body;
    files.forEach((file) => {
      const db = database.connect();
      db.prepare('DELETE FROM match WHERE id = ?').run(file.id);
      filesystem.delete(`${STORAGE.PATH}/${file.key}`);
    });
    respond(HTTPSuccess(OK, { sucess: true }), res);
  } catch (error) {
    respond(error, res);
  }
};
