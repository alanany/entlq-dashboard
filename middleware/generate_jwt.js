const jwt = require("jsonwebtoken");
const AppError = require("../utility/app_error");
const httpStatus = require("../utility/http_status");
const jwtSecret = process.env.JWT_SECRET || "your_jwt_secret_key";
  
module.exports = function generateJWT(user, next) {
  return new Promise((resolve, reject) => {
    jwt.sign( 
      { id: user._id, email: user.email,role:user.role },
      jwtSecret,
      { expiresIn: "10h" },  
      (err, token) => {
        if (err) {
          const error = AppError.createError({

            message: "Error generating token",    
            statusCode: httpStatus.FAILL,    
            status: 500,    
          });
          next(error);
          return reject(error);
        } 
        resolve(token);
      }
    );
  });
}
