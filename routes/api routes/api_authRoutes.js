const { Router } = require("express");
ApiAuthController = require("../../controllers/api controllers/api_authController");
const ApiAuthRouter = Router();
const multer = require("multer");
const upload = multer();
const { validationAnyRequestExpect } = require("../../validation/validation");
const  authenticate  = require("../../validation/authenticate_token");

ApiAuthRouter.post("/api/v1/login", upload.none(), ApiAuthController.login);
ApiAuthRouter.post(
  "/api/v1/register",
  upload.none(),
  validationAnyRequestExpect(["name",'password','phone_number','country_code','email','gender']),
  ApiAuthController.register
);

ApiAuthRouter.post("/api/v1/logout",authenticate, ApiAuthController.logOut);

module.exports = ApiAuthRouter;
