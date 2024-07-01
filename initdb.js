const AWS = require('aws-sdk');

AWS.config.update({
  region: "us-west-2",
  credentials: new AWS.SharedIniFileCredentials({ profile: "task" })
});

var ddb = new AWS.DynamoDB({ apiVersion: "2012-08-10" });

// Function to compare passwords
function comparePasswords(storedPassword, inputPassword) {
  // Implement your comparison logic here
  return storedPassword === inputPassword;
}

// Parameters for putting item
var putParams = {
  TableName: "UsersTable",
  Item: {
    useremail: { S: "adil@gmail.com" },
    password: { S: "admin" },
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
    useremail: { S: "adil@gmail.com" },
  }
};

// Call DynamoDB to read the item from the table
ddb.getItem(getParams, function (err, data) {
  if (err) {
    console.log("Error getting item:", err);
  } else {
    if (data.Item) {
      // Item found, now compare passwords
      var storedPassword = data.Item.password.S; // Assuming password is stored as a string attribute
      var inputPassword = "admin"; // Example input password to compare

      if (comparePasswords(storedPassword, inputPassword)) {
        console.log("Passwords match!");
      } else {
        console.log("Passwords do not match!");
      }
    } else {
      console.log("No item found for useremail: adil@gmail.com");
    }
  }
});
