const AWS = require('aws-sdk');
const dynamoDb = new AWS.DynamoDB.DocumentClient();

const validateUser = async (event) => {
  try {
    const requestBody = JSON.parse(event.body);
    const { useremail, password } = requestBody;

    const params = {
      TableName: 'users',
      Key: {
        useremail: useremail
      }
    };

    const data = await dynamoDb.get(params).promise();
    console.info('data from database:', data);
    if (data.Item && data.Item.password === password) { // Check password here
      // Successful login
      await publishSNSNotification(useremail);
      await publishUserValidationInfo(useremail);
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'User logged in successfully' })
      };
    } else {
      return {
        statusCode: 401, // Unauthorized
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


const publishUserValidationInfo = async (userEmail) => {
  const SNS = new AWS.SNS(); // Create an SNS client
  const params = {
    Message: JSON.stringify({ userEmail }), // Pass user email as message body
    TopicArn: process.env.SNS_TOPIC_ARN // Replace with your actual SNS topic ARN
  };
  await SNS.publish(params).promise();
};


const processUserValidation = async (event) => {
  try {
    const message = JSON.parse(event.Records[0].Sns.Message);
    const userEmail = message.userEmail;

    // Perform processing based on the received message
    console.log('Received message from SNS:', message);

    // Example: Perform some action with the userEmail received from SNS
    // For example, update a database, trigger another service, etc.

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message processed successfully' })
    };
  } catch (error) {
    console.error('Error processing SNS message:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to process SNS message' })
    };
  }
};


module.exports = {
  validateUser,
  processUserValidation
};


