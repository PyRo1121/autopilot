const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { countTokens } = require('./tokenHelper');

const { getCodeBaseAutopilotDirectory } = require('./autopilotConfig');

const DB_FILE_NAME = 'autopilot.db';

/**
 * @description Creates the "files" table in the SQLite database if it doesn't exist
 * @param {sqlite3.Database} db - The database connection
 */
function createFilesTable(db) {
  const sql = `
CREATE TABLE IF NOT EXISTS files (
    path TEXT PRIMARY KEY,
    tokensCount INTEGER,
    summary TEXT,
    summaryTokensCount INTEGER,
    hash TEXT,
    timestamp INTEGER,
    dependenciesLibs TEXT
);
`;
  db.run(sql, [], function (err) {
    if (err) {
      console.error('Error creating "files" table:', err);
    } else {
      console.log('The "files" table has been created successfully.');
    }
  });
}

/**
 * @description Creates the SQLite database and the "files" table if they don't exist
 * @param {string} codeBaseDirectory - The path to the .autopilot directory of the codebase
 */
function createDB(codeBaseDirectory) {
  const db = getDB(codeBaseDirectory);
  createFilesTable(db);
}

/**
 * @description Gets the file path of the SQLite database
 * @param {string} codeBaseDirectory
 * @returns {string} - The file path of the SQLite database
 */
function getDBFilePath(codeBaseDirectory) {
  const codeBaseAutopilotDirectory = getCodeBaseAutopilotDirectory(codeBaseDirectory);
  const dbFilePath = path.join(codeBaseAutopilotDirectory, DB_FILE_NAME);
  return dbFilePath;
}

/**
 * @description Creates the SQLite database and returns the database connection
 * @param {string} codeBaseDirectory - The path to the .autopilot directory of the codebase
 * @returns {sqlite3.Database} - The database connection
 */
function getDB(codeBaseDirectory) {
  const dbFilePath = getDBFilePath(codeBaseDirectory);
  const db = new sqlite3.Database(dbFilePath);
  db.serialize(() => {
    createFilesTable(db);
  });
  console.log(`Connected to SQLite database: ${dbFilePath}`);
  return db;
}

/**
 * Deletes the file at the specified file path from the "files" table in the SQLite database
 * located in the code base directory specified by the codeBaseDirectory parameter.
 * @param {string} codeBaseDirectory - The absolute path to the code base directory containing the SQLite database.
 * @param {string} filePath - The absolute path to the file to be deleted.
 */
function deleteFile(codeBaseDirectory, filePath) {
  const db = getDB(codeBaseDirectory);
  const sql = `DELETE FROM files WHERE path = ?`;
  db.run(sql, [filePath], function (err) {
    if (err) {
      console.error('Error deleting file:', err);
    } else {
      console.log(`File ${filePath} deleted successfully from the "files" table.`);
    }
  });
}

/**
 * @description Inserts or updates a file in the "files" table
 * @param {string} codeBaseDirectory - The path to the .autopilot directory of the codebase
 * @param {object} file - The file to insert or update
 * @param {string} file.filePath - The relative path of the file
 * @param {string} file.fileContent - The content of the file
 * @param {number} file.fileTokensCount - The count of tokens in the file
 * @param {string} file.fileHash - The hash of the file content
 * @param {number} file.fileTimestamp - The timestamp when the file was last modified
 * @param {string} summary - The summary of the file
 * @param {string} dependenciesLibs - The dependencies of the file
 */
function insertOrUpdateFile(codeBaseDirectory, file, summary, dependenciesLibs) {
  const db = getDB(codeBaseDirectory);
  const summaryTokensCount = countTokens(summary);
  const sql = `
INSERT OR REPLACE INTO files (
    path, 
    tokensCount,
    summary, 
    summaryTokensCount, 
    hash,
    timestamp,
    dependenciesLibs)
VALUES (?, ?, ?, ?, ?, ?, ?)
`;
  db.run(sql, [
    file.filePath,
    file.fileTokensCount,
    summary,
    summaryTokensCount,
    file.fileHash,
    file.fileTimestamp,
    dependenciesLibs
  ], function (err) {
    if (err) {
      console.error('Error inserting/updating file:', err);
    } else {
      console.log(`File ${file.filePath} inserted/updated successfully in the "files" table.`);
    }
  });
}

/**
 * @description Gets all files from the "files" table
 * @param {string} codeBaseDirectory - The path to the codebase
 * @returns {Promise<Array<{
    path: string, // The relative path of the file.
    hash: string, // The hash of the file content.
    timestamp: string // The timestamp when the file was last modified.
 }>>} - An array of objects containing file details retrieved from the directory.
 * @throws {Error} If an error occurs during the database query.
 */
async function getDBFiles(codeBaseDirectory) {
  const db = getDB(codeBaseDirectory);
  const sql = `SELECT path, hash, timestamp FROM files`;
  const files = await new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
  console.log('Retrieved files from the "files" table:', files);
  return files;
}

module.exports = {
  createDB, // Creates the SQLite database and the "files" table if they don't exist
  createFilesTable, // Creates the "files" table in the SQLite database if it doesn't exist
  insertOrUpdateFile, // Inserts or updates a file in the "files" table
  getDB, // Gets the SQLite database connection
  getDBFiles, // Gets all files from the "files" table
  deleteFile, // Deletes a file from the "files" table
  getDBFilePath // Gets the file path of the SQLite database
};
