/*****************************************************************************
*  WEB322 – Assignment 6
*  I declare that this assignment is my own work in accordance with Seneca 
*  Academic Policy. No part of this assignment has been copied manually or 
*  electronically from any other source (including web sites) or distributed 
*  to other students. 
*  
*  Name:         Samarth patel 
*  Student ID:   143147213 
*  Date:         December 8, 2022 
* 
*  Online (Heroku) URL: https://fathomless-falls-75906.herokuapp.com/about
* 
*****************************************************************************/  

const service = require('./data-service.js')
const serviceAuth = require('./data-service-auth.js')
const express = require("express");
const app = express();
const path = require("path");
const fs = require('fs');
const multer = require("multer");
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');
const clientSessions = require("client-sessions");

const HTTP_PORT = process.env.PORT || 8080;

// for css
app.use(express.static('public'));

// body parsing
app.use(bodyParser.urlencoded({extended: true}));

// defining storage
const storage = multer.diskStorage({
    destination: "./public/images/uploaded",
    filename: function (req, file, cb) {
        // write the filename as the current date down to the millisecond
        cb(null, Date.now() + path.extname(file.originalname));
    }
  });
  
// tell multer to use the diskStorage function for naming files instead of the default.
const upload = multer({ storage: storage });

// set up engine for handlebars
app.engine('.hbs', exphbs({ 
    extname: '.hbs', 
    defaultLayout: 'main',
    helpers: {
        // helper function for changing the navbar
        navLink: function(url, options) {
            return '<li' + 
                ((url == app.locals.activeRoute) ? ' class="active" ' : '') + 
                '><a href="' + url + '">' + options.fn(this) + '</a></li>';
        },
        equal: function(lvalue, rvalue, options) {
            if (arguments.length < 3)
                throw new Error("Handlebars Helper equal needs 2 parameters");
            if (lvalue != rvalue) {
                return options.inverse(this);
            } else {
                return options.fn(this);
            }
        }
    } 
}));
app.set('view engine', '.hbs');

// client sessions
app.use(clientSessions({
    cookieName: "session", 
    secret: "this_is_some_super_secret_string_for_web322_assignment6", 
    duration: 2 * 60 * 1000, // 2 minutes
    activeDuration: 1000 * 60 // 1 minute
}));

app.use(function(req, res, next) {
    res.locals.session = req.session;
    next();
});

// add middleware for the helper function
app.use(function(req,res,next) {
    let route = req.baseUrl + req.path;
    app.locals.activeRoute = (route == "/") ? "/" : route.replace(/\/$/, "");
    next();
});

// middleware function to check if the user is logged in
function ensureLogin(req, res, next) {
    if (!req.session.user) {
        res.redirect("/login");
    } else {
        next();
    }
}

// setting up default route
app.get("/", function(req,res) {
    res.render('home');
});

// setting up route for /about
app.get("/about", function(req,res) {
    res.render('about');
});

// route for /employees
app.get("/employees", ensureLogin, function(req,res) {
    // if /employees?status
    if (req.query.status) {
        service.getEmployeesByStatus(req.query.status)
        .then((value) => res.render('employees', {employees: value}))
        .catch((err) => res.render('employees', {message: err}));
    // /employees?department   
    } else if (req.query.department) {
        service.getEmployeesByDepartment(req.query.department)
        .then((value) => res.render('employees', {employees: value}))
        .catch((err) => res.render('employees', {message: err}));
    // /employees?manager
    } else if (req.query.manager) {
        service.getEmployeesByManager(req.query.manager)
        .then((value) => res.render('employees', {employees: value}))
        .catch((err) => res.render('employees', {message: err}));
    } else {
        // getAllEmployees if invalid query
        service.getAllEmployees()
        .then((value) => res.render('employees', {employees: value}))
        .catch((err) => res.render('employees', {message: err}));
    }
});

// setting up route for /employees/add
app.get("/employees/add", ensureLogin, function(req,res) {
    service.getDepartments()
    .then((value) => res.render('addEmployee', {departments: value}))
    .catch(() => res.render('addEmployee', {departments: null}));
});

// post for adding employees
app.post("/employees/add", ensureLogin, function(req,res) {
    service.addEmployee(req.body)
    .then(() => res.redirect('/employees'))
    .catch(() => res.status(500).render('employees', {message: "500: Unable to Add Employee"}));
});

// route for /employee/:employeeNum
app.get("/employee/:employeeNum", ensureLogin, function(req,res) {
    // parse if employeeNum is a number
    if (isNaN(req.params.employeeNum)) {
        // redirect if number is invalid
        res.redirect("/employees");    
    } else {

        let data = {};

        service.getEmployeesByNum(req.params.employeeNum)
        .then(function(value) {
            if (value) { 
                data.employee = value;
                service.getDepartments().then(function(value) {
                    data.departments = value;
                    for (let i = 0; i < data.departments.length; ++i) {
                        if (data.departments[i].departmentId == data.employee.department) {
                            data.departments[i].selected = true;
                            break;
                        }
                    }
                }).catch(() => { data.departments = []; })
                .then(() => res.render('employee', { data: data }));
            }
        })
        .catch(function() {
            res.status(404).render('employee', {message: "404: Employee not found"});
        });
    }
});

// updating employees
app.post("/employee/update", ensureLogin, (req, res) => {
    service.updateEmployee(req.body)
    .then(() => res.redirect("/employees"))
    .catch(() => { res.status(500).render('employee', {message: "500: Unable to Update Employee"}); });
});

app.get("/employees/delete/:empNum", ensureLogin, function(req,res) {
    service.deleteEmployeeByNum(req.params.empNum)
    .then(() => res.redirect("/employees"))
    .catch(() => { res.status(500).render('employee', {message: "500: Unable to Delete Employee"}); });
});

// route for /departments
app.get("/departments", ensureLogin, function(req,res) {
    service.getDepartments()
    .then((value) => res.render('departments', {departments: value}))
    .catch((err) => res.render('departments', {message: err}));
});

// route for /departments/add
app.get("/departments/add", ensureLogin, function(req,res) {
    res.render('addDepartment');
});

// post for adding departments
app.post("/departments/add", ensureLogin, function(req,res) {
    service.addDepartment(req.body)
    .then(() => { res.redirect('/departments') })
    .catch(() => { res.status(500).render('departments', {message: "500: Unable to Add Department"}); });
});

// post for updating departments
app.post("/department/update", ensureLogin, function(req,res) {
    service.updateDepartment(req.body)
    .then(() => { res.redirect('/departments') })
    .catch(() => { res.status(500).render('departments', {message: "500: Unable to Update Department"}); });
});

// get for editing departments
app.get("/department/:departmentId", ensureLogin, function(req,res) {
    service.getDepartmentById(req.params.departmentId)
    .then(function(value) {
        res.render('department', {department: value});
    })
    .catch(function(err) {
        res.status(404).render('department', {message: "404: " + err});
    });
});

app.get("/departments/delete/:departmentId", ensureLogin, function(req,res) {
    service.deleteDepartmentById(req.params.departmentId)
    .then(function() {
        res.redirect("/departments");
    })
    .catch(function(err) {
        res.status(500).render('department', {message: err});
    });
})

// setting up route for /images/add
app.get("/images/add", ensureLogin, function(req,res) {
    res.render('addImage');
});

app.post("/images/add", ensureLogin, upload.single("imageFile"), function(req, res) {
    res.redirect('/images');
});

// route for /images
app.get("/images", ensureLogin, function(req,res) {
    // read directory
    fs.readdir(path.join(__dirname,"/public/images/uploaded"), 
    function(err, items) {
            res.render('images', {images: items});
    });
});

// route for login page
app.get("/login", function(req, res) {
    res.render('login');
});

// route for registration page
app.get("/register", function(req, res) { 
    res.render('register');
});

// post for /register
app.post("/register", function(req, res) {
    serviceAuth.registerUser(req.body)
    .then(() => res.render('register', { successMsg: "User created!"}))
    .catch((err) => res.render('register', { errorMsg: err, userName: req.body.userName }));
});

// post for /login
app.post("/login", function(req, res) {
    req.body.userAgent = req.get('User-Agent');

    serviceAuth.checkUser(req.body)
    .then(function(user) { 
        req.session.user = {
            userName: user.userName,
            email: user.email,
            loginHistory: user.loginHistory
        }

        res.redirect('/employees');
    })
    .catch(function(err) {
        console.log(err);
        res.render('login', { errorMsg: err, userName: req.body.userName });
    });
});

// loggin' out
app.get("/logout", function(req, res) {
    req.session.reset();
    res.redirect('/');
});

// user history
app.get("/userHistory", ensureLogin, function (req, res) {
    res.render('userHistory');
}); 

// 404 message
app.use(function(req,res,next) {
    res.status(404).render('fourohfour');
});

// setup listen
service.initialize()
.then(serviceAuth.initialize)
.then(function(msg) {
    console.log(msg);
    app.listen(HTTP_PORT);
})
.catch(function(err) {
    console.log(err);
});