const AWS = require('aws-sdk');
const speakeasy = require('speakeasy');
const dynamoDb = new AWS.DynamoDB({ apiVersion: "2012-08-10" });
const ses = new AWS.SES({ region: 'us-west-2' });

const validateUser = async (event) => {
  try {
    const requestBody = JSON.parse(event.body);
    const { useremail, password } = requestBody;
    console.info('Event received:', requestBody);

    const params = {
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        useremail: { S: useremail }
      }
    };
    console.info('Params for database:', params);

    const data = await dynamoDb.getItem(params).promise();
    console.info('Data from database:', data);

    if (data.Item && data.Item.password.S === password) {
      // Successful login
      await publishUserValidationInfo(data.Item.useremail.S);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'User logged in successfully' })
      };
    } else {
      // Unauthorized if either user not found or password doesn't match
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Invalid credentials' })
      };
    }
  } catch (error) {
    console.error('Error validating user:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to validate user' })
    };
  }
};

// Publish user email to SNS topic after successful login
const publishUserValidationInfo = async (userEmail) => {
  const SNS = new AWS.SNS();
  const message = JSON.stringify({ userEmail });
  console.log('Publishing message to SNS:', message); // Log the message content

  const params = {
    Message: message,
    TopicArn: process.env.SNS_TOPIC_ARN
  };
  
  try {
    const data = await SNS.publish(params).promise();
    console.log('Message published to SNS:', data.MessageId); // Log the message ID if needed
  } catch (error) {
    console.error('Failed to publish message to SNS:', error);
    throw error; // Re-throw the error to handle it in the caller function if necessary
  }
};


const processUserValidation = async (event) => {
  try {
    const message = JSON.parse(event.Records[0].Sns.Message);
    const userEmail = message.userEmail;

    // Generate 2FA code
    const secret = speakeasy.generateSecret({ length: 6 });
    const twoFactorCode = secret.base32;


    var updateParams = {
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        'useremail': { S: userEmail }, // Assuming userEmail is the partition key
      },
      UpdateExpression: 'SET twoFactorCode = :codeValue', // Update the twoFactorCode attribute
      ExpressionAttributeValues: {
        ':codeValue': { S: twoFactorCode }, // New value for twoFactorCode attribute
      },
      // Optional: Add ConditionExpression if you want to update conditionally
      // ConditionExpression: 'attribute_not_exists(twoFactorCode)', // Example condition
    };

// Call DynamoDB to update the item in the table
dynamoDb.updateItem(updateParams, function (err, data) {
  if (err) {
    console.log("Error updating item:", err);
  } else {
    console.log("Successfully updated item in UsersTable:", data);
  }
});

    // Send code to user via SES
    const emailParams = {
      Destination: {
        ToAddresses: [userEmail]
      },
      Message: {
        Body: {
          Text: {
            Data: `Your verification code is: ${twoFactorCode}`
          }
        },
        Subject: {
          Data: 'Your Two-Factor Authentication Code'
        }
      },
      Source: 'adilm717@gmail.com'  
    };

    await ses.sendEmail(emailParams).promise();

    console.log('Two-factor authentication code sent to:', userEmail);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message processed successfully' })
    };
  } catch (error) {
    console.error('Error processing SNS message:', error);

    // Check if error is SES specific
    if (error.code === 'MessageRejected') {
      // Handle message rejection error
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Message rejected by SES' })
      };
    } else {
      // Handle generic error
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to process SNS message' })
      };
    }
  }
};



module.exports = {
  validateUser,
  processUserValidation
};


