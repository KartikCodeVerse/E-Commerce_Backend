import express from "express";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import multer from "multer";
import cors from "cors";
import path from "path";

dotenv.config();
const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(cors());

// API Creation

app.get("/", (req, res) => {
  res.send("Express App is Running");
});

// Image Storage Engine
const Stroage = multer.diskStorage({
  destination: `./upload/images`,
  filename: (req, file, cb) => {
    cb(
      null,
      `${file.fieldname}_${Date.now()}${path.extname(file.originalname)}`
    );
  },
});

const upload = multer({ storage: Stroage });

// Serve images statically
app.use("/images", express.static("upload/images"));

// Upload route
app.post("/upload", upload.single("product"), (req, res) => {
  console.log(req.file);
  res.json({
    success: 1,
    image_url: `http://localhost:${port}/images/${req.file.filename}`,
    message: "File uploaded successfully",
  });
});

// Schema for Creating Products

const Products = mongoose.model("Products", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  old_price: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
});

// Schema for Users

const Users = mongoose.model("Users", {
  name: {
    type: String,
  },
  email: {
    type: String,
    require: true,
    index: true,
    unique: true,
    sparse: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    deafault: Date.now,
  },
});

// Creating Endpoint for registering the user
app.post("/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    let existingUser = await Users.findOne({ email: email });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "existing user found with same email address",
      });
    }
    let cart = {};
    for (let i = 0; i < 300; i++) {
      cart[i] = 0;
    }

    const newUser = new Users({
      name: username,
      email: email,
      password: password,
      cartData: cart,
    });

    await newUser.save();

    const data = {
      user: {
        id: newUser.id,
      },
    };

    const token = jwt.sign(data, process.env.JWT_KEY);
    res.json({ success: true, token });
  } catch (error) {
    console.error("Error during signup:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Creating Endpoint for user login
app.post("/login", async (req, res) => {
  let user = await Users.findOne({ email: req.body.email });
  if (user) {
    const passCompare = req.body.password === user.password;
    if (passCompare) {
      const data = {
        user: {
          id: user.id,
        },
      };
      const token = jwt.sign(data, process.env.JWT_KEY);
      res.json({ success: true, token });
    } else {
      res.json({ success: false, error: "Wrong Password" });
    }
  } else {
    res.json({ success: false, error: "Wrong Email Id" });
  }
});

// Add Product in DB

app.post("/addproduct", async (req, res) => {
  let products = await Products.find();
  let id;

  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }
  const product = new Products({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    old_price: req.body.old_price,
  });

  await product.save();
  console.log("Saved");
  res.json({ success: true, name: req.body.name });
});

// Remove Product from DB

app.post("/removeproduct", async (req, res) => {
  await Products.findOneAndDelete({ id: req.body.id });
  console.log("Removed");
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Getting All Product
app.get("/allproducts", async (req, res) => {
  let product = await Products.find({});
  console.log("All Product Fetched");
  res.json(product);
});

// Creating endpoint for newcollection data
app.get("/newcollections", async (req, res) => {
  let products = await Products.find({});

  let newcollection = products.slice(1).slice(-8);
  console.log("New Collection Fetched");
  res.send(newcollection);
});

// Creating endpoint for popular in women section
app.get("/popularinwomen", async (req, res) => {
  let products = await Products.find({ category: "women" });
  let popular_in_women = products.slice(0, 4);
  console.log("Popular in Women Fetched");
  res.send(popular_in_women);
});

// Creating middleware to fetch user

const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({ error: "Please authenticate using valid token" });
  } else {
    try {
      const data = jwt.verify(token, "secret_ecom");
      req.user = data.user;
      next();
    } catch (error) {
      res.status(401).send({ error: "Please authenticate using valid token" });
    }
  }
};

// Creating endpoint for add product in cartdata
app.post("/addtocart", fetchUser, async (req, res) => {
  console.log("added", req.body.itemId);
  let userData = await Users.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Added");
});

// Creating endpoint for add product in cartdata
app.post("/removefromcart", fetchUser, async (req, res) => {
  console.log("remove", req.body.itemId);
  let userData = await Users.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] -= 1;
  await Users.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Removed");
});

// Create endpoint to get cartdata
app.post("/getcart", fetchUser, async (req, res) => {
  console.log("GetCart");
  let userData = await Users.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

// Database Connection
mongoose
  .connect(process.env.DB_URL)
  .then(() => {
    console.log("Connected to MongoDB");
    // Start the server after successful database connection
    app.listen(port, (error) => {
      if (!error) {
        console.log(`Server Running on Port ${port}`);
      } else {
        console.log("Error :" + error);
      }
    });
  })
  .catch((error) => {
    console.error("Error connecting to MongoDB:", error);
  });
