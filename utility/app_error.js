const { json } = require("express");

class AppError extends Error {
  constructor() {
    super();
  } 
  createError({message, statusCode,status} ) {
    this .message = message;
    this.statusCode = statusCode;
        this.status = status;

return json({message: this.message, statusCode: this.statusCode, status: this.status});
  }
}
module.exports =new AppError();  