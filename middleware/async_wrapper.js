const asyncWrapper = (fn) => {
  return async (req, res, next) => {
    try {
     await fn(req, res, next);
    } catch (error) {

 res.render("../views/404.ejs");    }
  };
};

module.exports = asyncWrapper;
