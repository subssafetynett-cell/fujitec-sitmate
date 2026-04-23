const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const Response = require('./models/Response'); // Adjust path as needed
    const latest = await Response.findOne({ category: 'SHEQ Inspection installation report' }).sort({ createdAt: -1 });
    if (latest) {
      console.log(JSON.stringify(latest.answers.formData, null, 2));
    } else {
      console.log("No response found");
    }
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
