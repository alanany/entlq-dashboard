const { Router } = require('express');
const ApiCoursesRouter = Router();
const  authenticate  = require('../../validation/authenticate_token');
const ApiCoursesController = require('../../controllers/api controllers/api_coursesController ');
const multer = require("multer");
const upload = multer();
const { validationAnyRequestExpect } = require("../../validation/validation");

ApiCoursesRouter.get('/api/v1/courses',authenticate,ApiCoursesController.getapicourses);
ApiCoursesRouter.get('/api/v1/course_details/:id',authenticate,upload.none(),ApiCoursesController.getapiCourseDetails);
ApiCoursesRouter.post('/api/v1/course_checkout',authenticate,upload.none(),
  validationAnyRequestExpect([]),ApiCoursesController.apiCourseCheckout);
module.exports = ApiCoursesRouter;