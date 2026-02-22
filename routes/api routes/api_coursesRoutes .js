const { Router } = require('express');
const ApiCoursesRouter = Router();
const  authenticate  = require('../../validation/authenticate_token');
const ApiCoursesController = require('../../controllers/api controllers/api_coursesController ');
const multer = require("multer");
const upload = multer();
const { validationAnyRequestExpect } = require("../../validation/validation");

ApiCoursesRouter.get('/api/v1/courses/:academyId',authenticate,ApiCoursesController.getapicourses);
ApiCoursesRouter.get('/api/v1/course_details/:id',authenticate,upload.none(),ApiCoursesController.getapiCourseDetails);
ApiCoursesRouter.get('/api/v1/student-sessions/:id',authenticate,ApiCoursesController.getStudentSessionsPage);
ApiCoursesRouter.get('/api/v1/student-dashboard', authenticate, ApiCoursesController.getStudentApiDashboard);
ApiCoursesRouter.get('/api/v1/academy-info', authenticate, ApiCoursesController.getAcademyInfo);
ApiCoursesRouter.get('/api/v1/categories', authenticate, ApiCoursesController.getApiCategories);
ApiCoursesRouter.get('/api/v1/blog-posts', authenticate, ApiCoursesController.getApiBlogPosts);

ApiCoursesRouter.post('/api/v1/course_checkout',authenticate,upload.none(),
  validationAnyRequestExpect([]),ApiCoursesController.apiCourseCheckout);
module.exports = ApiCoursesRouter;