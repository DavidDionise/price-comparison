const { MongoClient } = require("mongodb");
const https = require("https");
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
    { id: "icoValue", title: "ICO Value" },
    { id: "status", title: "Status" }
  ]
});

async function main() {
  try {
    const client = await MongoClient.connect(URL);
    const db = client.db(DB_NAME);
    const inspectionsCollection = db.collection("inspection");
    const inspections = inspectionsCollection.find({});
    const records = await processInspections(inspections);
    await csvWriter.writeRecords(records);
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
        year: lead.vehicle.year,
        make: lead.vehicle.make,
        model: lead.vehicle.model,
        trim: lead.vehicle.trim,
        icoValue: lead.offer.icoValue,
        status: inspection.status
      };

      if (inspection.status == "ACCEPTED" || inspection.status == "DECLIINED") {
        getFinalOffer(inspection._id)
          .then(response => {
            const { offerAmount } = response;
            record.finalOffer = offerAmount;
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

function getFinalOffer(inspectionId) {
  return new Promise((resolve, reject) => {
    let rawData = ""
    https.get(
      `${BACKPACK_URL}/inspections/${inspectionId}/result?key=${BACKPACK_API_KEY}`,
      {
        rejectUnauthorized: false
      },
      (res) => {
        res.on("data", (data) => rawData += data.toString());
        res.on("end", () => resolve(JSON.parse(rawData)));
      }
    ).on("error", reject);
  });
}

Promise.resolve(main())
  .then(() => process.exit())
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
