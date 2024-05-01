const express = require("express");
const admin = require("firebase-admin");
const jwt = require("jsonwebtoken");
const emailjs = require("@emailjs/nodejs");
const serviceAccount = require("./bloodbank-cert.json");

const app = express();
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DB_URL,
});

const db = admin.database();

const JWT_SECRET = process.env.JWT_SECRET;

const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    // Extract token without 'Bearer ' prefix
    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        console.error("JWT Verification Error:", err);
        return res.sendStatus(403);
      }

      req.user = user;
      next();
    });
  } else {
    res.sendStatus(401);
  }
};

app.post("/sendNotification", authenticateJWT, (req, res) => {
  const {
    title,
    body,
    senderId,
    userId,
    profileImage,
    confirmation,
    targetToken,
  } = req.body;

  const message = {
    notification: {
      title,
      body,
    },
    data: {
      senderId,
      userId,
      profileImage,
      confirmation,
    },
    token: targetToken,
  };

  admin
    .messaging()
    .send(message)
    .then((response) => {
      console.log("Successfully sent message:", response);
      res.status(200).send(response);
    })
    .catch((error) => {
      console.error("Error sending message:", error);
      res.status(500).send(error);
    });
});

app.post("/genToken", async (req, res) => {
  const { userId, username, password } = req.body;

  const userDetailsSnapshot = await db.ref(`users/${userId}`).once("value");
  const userDetails = userDetailsSnapshot.val();

  if (
    userDetails &&
    userDetails.name === username &&
    userDetails.password === password
  ) {
    const token = jwt.sign({ userId }, JWT_SECRET);
    res.json({ token });
  } else {
    res.sendStatus(401);
  }
});

app.post("/sendContactForm", authenticateJWT, (req, res) => {
  const { name, email, message } = req.body;

  const formData = {
    from_name: name,
    from_email: email,
    message: message,
  };

  emailjs
    .send(
      process.env.EMAIL_SERVICE_ID,
      process.env.EMAIL_TEMPLATE_ID,
      formData,
      {
        publicKey: process.env.EMAIL_PUBLIC_KEY,
        privateKey: process.env.EMAIL_PRIVATE_KEY,
      }
    )
    .then((result) => {
      console.log("Successfully sent contact form:", result);
      res.status(200).send(result);
    })
    .catch((error) => {
      console.error("Error sending contact form:", error);
      res.status(500).send(error);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port: ${PORT}`);
});
