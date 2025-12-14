const httpStatus = require("../utility/http_status");
const AppError = require("../utility/app_error");
const asyncWrapper = require("../middleware/async_wrapper");
const { validationResult } = require("express-validator");
const moment = require("moment");
const customer = require("../models/customer_model.js");
const { _pluralize } = require("mongoose");

// GET - Show Add User Form
const addUser = asyncWrapper(async (req, res) => {
  console.log("User data:", req.body);

  res.render("/user/add.html", { errors: {}, formData: {} });
});

// POST - Create User
const createUser = async (req, res, next) => {
  const userId = req.user.id; // هنا ستكون موجودة
  console.log("User user_id:", userId);
req.body.userId = userId;
  try {
    await customer.create(
      req.body);
    res.redirect("/");
  } catch (err) {
    console.log("User errors:", err);
    // Mongoose validation errors
    if (err && err.name === "MongooseError") {
      console.log("Mongoose validation error:", err);

      return res.redirect("/user/add.html", {
        errors: err,
        formData: req.body,
      });
    }

    // Duplicate key (unique) error e.g. email already exists
    if (err && (err.code === 11000 || err.code === 11001)) {
      console.log("Duplicate key error:", err);
      const errors = {};
      const key = Object.keys(err.keyValue || {})[0] || "email";
      errors[key] = `${
        key.charAt(0).toUpperCase() + key.slice(1)
      } already exists`;
      alert(errors[key]);
      return res.redirect("/user/add.html", { errors, formData: req.body });
    }

    // fallback
    //return next(err);
  }
};

const searchUser = asyncWrapper(async (req, res) => {
  const search = req.body.title||"";
  console.log(search);
    const userId = req.user.id;
  const users = await customer.find({
 userId: userId,
     $or: [
      { firstName: new RegExp(search, "i") },
      { lastName: new RegExp(search, "i") },
      { email: new RegExp(search, "i") },
    ],
  });

  console.log(users);
  res.render("user/search", { users: users, moment: moment });
});
const getSingleUser = asyncWrapper(async (req, res) => {
  const id = req.params.id;
    const userId = req.user.id;

   const user = await customer.findOne(
    { _id: id  ,userId: userId },
  ); 
  res.render("user/view", { user: user, moment: moment });
});

const getAllUsers = asyncWrapper(async (req, res) => {
const userId = req.user.id;
console.log(userId);
 const users = await customer.find(
    { userId: userId },
  );  res.render("index.ejs", { users: users, moment: moment });
});

const deleteUser = asyncWrapper(async (req, res) => {
   const id = req.params.id;
    const userId = req.user.id;

  const result = await customer.findByIdAndDelete(    { _id: id  ,userId: userId },);
  console.log("result", result);

  res.redirect("/");
});

const getupdateUser = asyncWrapper(async (req, res) => {
    const id = req.params.id;
    const userId = req.user.id;

  const user = await customer.findOne(    { _id: id  ,userId: userId },);
 console.log(user);
  res.render("user/edit", { user: user, moment: moment });
});

const updateUser = asyncWrapper(async (req, res) => {
    const id = req.params.id;
    const userId = req.user.id;

  const user = await customer.findByIdAndUpdate(    { _id: id  ,userId: userId }, req.body,{new:true} );
  console.log(user);
  res.redirect("/");
});

module.exports = {
  addUser,
  createUser,
  getSingleUser,
  getAllUsers,
  deleteUser,
  getupdateUser,
  updateUser,
  searchUser,
};
