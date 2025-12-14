const secret_key = require("../utility/secret_key.js");
const mongoose = require("mongoose");
async function connectMango () {
 const result = await mongoose  .connect(secret_key.SECRETKEY, {
  dbName: secret_key.database
   })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Could not connect to MongoDB...", err)); 
console
}

module.exports = connectMango;