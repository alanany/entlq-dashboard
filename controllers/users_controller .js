const httpStatus = require("../utility/http_status");
const AppError = require("../utility/app_error");
const asyncWrapper = require("../middleware/async_wrapper");
const moment = require("moment");
const { AppDataSource } = require('../config/database');

// GET - Show Add User Form
const addUser = asyncWrapper(async (req, res) => {
  console.log("User data:", req.body);
  res.render("/user/add.html", { errors: {}, formData: {} });
});

// POST - Create User
const createUser = async (req, res, next) => {
  const userId = req.user.id;
  console.log("User user_id:", userId);
  req.body.userId = userId;
  
  try {
    const customerRepository = AppDataSource.getRepository('Customer');
    const customer = customerRepository.create(req.body);
    await customerRepository.save(customer);
    
    res.redirect("/");
  } catch (err) {
    console.log("User errors:", err);

    // Duplicate key (unique) error
    if (err && (err.code === 'ER_DUP_ENTRY' || err.errno === 1062)) {
      console.log("Duplicate key error:", err);
      const errors = { general: "This record already exists" };
      return res.redirect("/user/add.html", { errors, formData: req.body });
    }

    // fallback
    return res.redirect("/user/add.html", {
      errors: { message: err.message },
      formData: req.body,
    });
  }
};

const searchUser = asyncWrapper(async (req, res) => {
  const search = req.body.title || "";
  console.log(search);
  const userId = req.user.id;
  
  const customerRepository = AppDataSource.getRepository('Customer');
  
  // Using query builder for advanced OR logic
  const users = await customerRepository.createQueryBuilder("customer")
    .where("customer.userId = :userId", { userId: userId.toString() })
    .andWhere("(customer.firstName LIKE :search OR customer.lastName LIKE :search OR customer.email LIKE :search)", { search: `%${search}%` })
    .getMany();

  console.log(users);
  res.render("user/search", { users: users, moment: moment });
});

const getSingleUser = asyncWrapper(async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  const customerRepository = AppDataSource.getRepository('Customer');

  const user = await customerRepository.findOne({ where: { id: parseInt(id), userId: userId.toString() } }); 
  res.render("user/view", { user: user, moment: moment });
});

const getAllUsers = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  console.log(userId);
  const customerRepository = AppDataSource.getRepository('Customer');
  
  const users = await customerRepository.find({ where: { userId: userId.toString() } });  
  res.render("index.ejs", { users: users, moment: moment });
});

const deleteUser = asyncWrapper(async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  const customerRepository = AppDataSource.getRepository('Customer');

  const customer = await customerRepository.findOne({ where: { id: parseInt(id), userId: userId.toString() } });
  if (customer) {
    await customerRepository.remove(customer);
  }
  
  res.redirect("/");
});

const getupdateUser = asyncWrapper(async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  const customerRepository = AppDataSource.getRepository('Customer');

  const user = await customerRepository.findOne({ where: { id: parseInt(id), userId: userId.toString() } });
  console.log(user);
  res.render("user/edit", { user: user, moment: moment });
});

const updateUser = asyncWrapper(async (req, res) => {
  const id = req.params.id;
  const userId = req.user.id;
  const customerRepository = AppDataSource.getRepository('Customer');

  let customer = await customerRepository.findOne({ where: { id: parseInt(id), userId: userId.toString() } });
  if (customer) {
    customer = customerRepository.merge(customer, req.body);
    await customerRepository.save(customer);
    console.log(customer);
  }
  
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
