const { MongoClient } = require("mongodb");
const axios = require("axios");
const _ = require("lodash");

const URL = process.env.MONGO_DB_URL;
const DB_NAME = process.env.MONGO_DB_NAME;
const BACKPACK_URL = process.env.BACKPACK_URL || "http://localhost:3000";
const BACKPACK_API_KEY = process.env.BACKPACK_API_KEY || "";
const LIMIT = process.env.LIMIT || 25;

async function main() {
  const client = await MongoClient.connect(URL);
  const db = client.db(DB_NAME);
  const inspectionsCollection = db.collection("inspection");
  const inspections = await inspectionsCollection.find({ status: "ACCEPTED" }, { limit: LIMIT }).toArray();
  const report = await Promise.all(
    inspections.map((inspection) => (
      axios.get(`${BACKPACK_URL}/inspections/${inspection._id}/result?key=${BACKPACK_API_KEY}`)
        .then(({ data: { offerAmount } }) => {
          const { lead : { vehicle, offer: { icoValue } } } = inspection;
          return {
            ID: inspection._id,
            VIN: vehicle.vin,
            Year: vehicle.year,
            Make: vehicle.make,
            Model: vehicle.model,
            Condition: vehicle.condition.overallCondition,
            "ICO Value": icoValue,
            "Final Offer": offerAmount,
            "Difference": icoValue - offerAmount
          };
        })
      ))
  );

  console.table(report);
}

Promise.resolve(main())
  .then(() => process.exit())
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });