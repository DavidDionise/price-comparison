const { MongoClient } = require("mongodb");
const axios = require("axios");
// const { Console } = require("console");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const path = require("path");
const fs = require("fs");

const URL = process.env.MONGO_DB_URL;
const DB_NAME = process.env.MONGO_DB_NAME;
const BACKPACK_URL = process.env.BACKPACK_URL || "http://localhost:3000";
const BACKPACK_API_KEY = process.env.BACKPACK_API_KEY || "";

const csvWriter = createCsvWriter({
  path: path.resolve(__dirname, "output.csv"),
  header: [
    { id: "year", title: "Year" },
    { id: "make", title: "Make" },
    { id: "model", title: "Model" },
    { id: "trim", title: "Trim" },
    { id: "finalOffer", title: "Final Offer" },
    { id: "icoValue", title: "ICO Value" }
  ]
});

async function main() {
  try {
    // const client = await MongoClient.connect(URL);
    // const db = client.db(DB_NAME);
    // const inspectionsCollection = db.collection("inspection");
    // const inspections = inspectionsCollection.find({});
    // const records = await processInspections(inspections);
    // await csvWriter.writeRecords(records);
    const result = await axios.get(
      "https://roam-staging-api.detroitlabs.com/inspections/5e3aea0ea27d7c61990f9df1/result?key=AIzaSyA04HCMZhNYyXk4IER0qb2GSfmGAVR15O4"
    )
  } catch (ex) {
    console.error(">> ERROR : ", ex);
  }
}

async function processInspections(inspectionsCursor) {
  return new Promise((res, rej) => {
    const records = [];
    inspectionsCursor.on("data", inspection => {
      inspectionsCursor.pause();
      const { lead } = inspection;
      const record = {
        year: inspection.year,
        make: lead.vehicle.make,
        model: lead.vehicle.model,
        trim: lead.vehicle.trim,
        icoValue: lead.offer.icoValue
      };

      if (inspection.status == "ACCEPTED" || inspection.status == "DECLIINED") {
        getFinalOffer(inspection._id)
          .then(finalOffer => {
            console.log(">> Setting final offer: ", finalOffer);
            record.finalOffer = finalOffer;
            records.push(record);
            inspectionsCursor.resume();
          })
          .catch(err => {
            console.error(">> Error processing ", inspection._id);
          });
      } else {
        records.push(record);
        inspectionsCursor.resume();
      }
    });

    inspectionsCursor.on("end", err => (err ? rej(err) : res(records)));
  });
}

async function getFinalOffer(inspectionId) {
  try {
    const result = await axios.get(
      `${BACKPACK_URL}/inspections/${inspectionId}/result?key=${BACKPACK_API_KEY}`
    );
    console.log(">> RESULT : ", result);
    return result.data.offerAmount;
  } catch (ex) {
    console.error(">> ERROR GETTING FINAL OFFER : ", ex);
  }
}

Promise.resolve(main())
  .then(() => process.exit())
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
