const dotenv = require("dotenv");
dotenv.config();

const PORT=process.env.PORT || 3000;
const SECRETKEY = process.env.SECRETKEY;
 const database = process.env.DATABASE ;
module.exports = {SECRETKEY,database,PORT};