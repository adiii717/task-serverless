const AWS = require('aws-sdk');

AWS.config.update({
  region: "us-west-2",
  credentials: new AWS.SharedIniFileCredentials({ profile: "task" })
});

var ddb = new AWS.DynamoDB({ apiVersion: "2012-08-10" });

// Default email and password
const defaultEmail = "adil@gmail.com";
const defaultPassword = "admin";

// Function to compare passwords
function comparePasswords(storedPassword, inputPassword) {
  // Implement your comparison logic here
  return storedPassword === inputPassword;
}

// Parameters for putting item
var putParams = {
  TableName: "UsersTable",
  Item: {
    useremail: { S: defaultEmail },
    password: { S: defaultPassword },
  },
};

// Call DynamoDB to add the item to the table
ddb.putItem(putParams, function (err, data) {
  if (err) {
    console.log("Error putting item:", err);
  } else {
    console.log("Successfully added item to UsersTable:", data);
  }
});

// Parameters for getting item
var getParams = {
  TableName: "UsersTable",
  Key: {
    useremail: { S: defaultEmail },
  }
};
