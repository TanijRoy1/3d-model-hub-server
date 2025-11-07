const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;
const admin = require("firebase-admin");
const serviceAccount = require("./model-hub-firebase-adminsdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


// Middleware
app.use(cors());
app.use(express.json());

const verifyFirebaseToken = async (req, res, next) => {
  // console.log(req.headers.authorization);
  if(!req.headers.authorization){
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.token_email = userInfo.email;
    next();
  } catch (error) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.z1gnsog.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("3d model hub server is running.");
});

async function run() {
  try {
    await client.connect();


    const modelsDB = client.db("modelsDB");
    const modelsCollection = modelsDB.collection("models");

    app.get("/models", async (req, res) => {
      const cursor = modelsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    })
    app.get("/myModels", verifyFirebaseToken, async (req, res) => {
      const email = req.query.email;
      const query = {};
      if(email){
        if(email !== req.token_email){
          return res.status(403).send({ message: "Forbidden access" });
        }
        query.created_by = email;
      }
        const cursor = modelsCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
    })
    app.get("/latestModels", async (req, res) => {
      const cursor = modelsCollection.find().sort({created_at : -1}).limit(8);
      const result = await cursor.toArray();
      res.send(result);
    })
    app.get("/models/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id : new ObjectId(id)};
      const result = await modelsCollection.findOne(query);
      res.send(result);
    })
    app.patch("/models/:id", async (req, res) => {
      const id = req.params.id;
      const updatedModel = req.body;
      const query = {_id : new ObjectId(id)};
      const update = {
        $set: {
          name: updatedModel.name,
          category: updatedModel.category,
          thumbnailUrl: updatedModel.thumbnailUrl,
          description: updatedModel.description,
        }
      }
      const result = await modelsCollection.updateOne(query, update);
      res.send(result);
    })
    app.post("/models", async (req, res) => {
      const newModel = req.body;
      const result = await modelsCollection.insertOne(newModel);
      res.send(result);
    })



    await client.db("admin").command({ ping: 1 });
    console.log("✅ Pinged your deployment. Yor are successfully connected to MongoDB!");
  } finally {
    // Optionally close the client when needed
  }
}

run().catch(console.dir);

app.listen(port, () => {
  console.log(`3d model hub server running on port: ${port}`);
});