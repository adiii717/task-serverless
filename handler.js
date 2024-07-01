const AWS = require('aws-sdk');
const speakeasy = require('speakeasy');
const dynamoDb = new AWS.DynamoDB({ apiVersion: "2012-08-10" });
const ses = new AWS.SES({ region: 'us-west-2' });

// lambda function for validate user
const UserLoginHandler = async (event) => {
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


// login Lambda form
const GetLoginFormHandler = async () => {
  const htmlForm = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Login</title>
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: Arial, sans-serif;
          }
          .container {
            width: 300px;
            text-align: center;
          }
          .form-group {
            margin-bottom: 15px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div id="loginForm">
            <form id="loginFormInner" class="form-group">
              <label for="useremail">Email:</label><br>
              <input type="email" id="useremail" name="useremail" required><br>
              <label for="password">Password:</label><br>
              <input type="password" id="password" name="password" required><br><br>
              <input type="submit" value="Submit">
            </form>
          </div>
          
          <div id="2faForm" style="display: none;">
            <form id="2faFormInner" class="form-group">
              <label for="twofa">2FA Code:</label><br>
              <input type="text" id="twofa" name="twofa" required><br><br>
              <input type="submit" value="Submit 2FA Code">
            </form>
          </div>
          
          <div id="welcomeMessage" style="display: none;">
            <p>Welcome, you are logged in!</p>
          </div>
        </div>
        
        <script>
          document.getElementById('loginFormInner').onsubmit = async function(e) {
            e.preventDefault();
            const useremail = document.getElementById('useremail').value;
            const password = document.getElementById('password').value;
            const response = await fetch('/dev/login', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ useremail, password }),
            });
            const result = await response.json();
            
            if (response.status === 200) {
              // Disable login form
              document.getElementById('loginForm').style.display = 'none';
              // Show 2FA form
              document.getElementById('2faForm').style.display = 'block';
            } else {
              // Handle unsuccessful login
              alert(result.message);
            }
          };
          
          document.getElementById('2faFormInner').onsubmit = async function(e) {
            e.preventDefault();
            const twofaCode = document.getElementById('twofa').value;
            const response2FA = await fetch('/dev/login/2fa', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ twofaCode }),
            });
            const result2FA = await response2FA.json();
            
            if (response2FA.status === 200) {
              // Hide 2FA form
              document.getElementById('2faForm').style.display = 'none';
              // Show welcome message
              document.getElementById('welcomeMessage').style.display = 'block';
            } else {
              // Handle unsuccessful 2FA verification
              alert(result2FA.message);
            }
          };
        </script>
      </body>
    </html>
  `;
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/html',
    },
    body: htmlForm,
  };
};






//  Publish user email to SNS topic after successful login
const publishUserValidationInfo = async (userEmail) => {
  const SNS = new AWS.SNS();
  const message = JSON.stringify({ userEmail });
  console.log('Publishing message to SNS:', message);
  const params = {
    Message: message,
    TopicArn: process.env.SNS_TOPIC_ARN
  };
  try {
    const data = await SNS.publish(params).promise();
    console.log('Message published to SNS:', data.MessageId);
  } catch (error) {
    console.error('Failed to publish message to SNS:', error);
    throw error; 
  }
};



// second lambda function for 2fa and auth handling, accept user email as input
// Second Lambda function for 2FA and auth handling, accepts user email as input
const processUserValidation = async (event) => {
  try {
    // Check if it's a direct POST request for 2FA verification
    if (event.httpMethod === 'POST' && event.path === '/login/2fa') {
      const body = JSON.parse(event.body);
      const twofaCode = body.twofaCode; // Assuming twofaCode is sent in the request body

      // Dummy validation of 2FA code (always consider it valid)
      if (twofaCode === '123456') {
        return {
          statusCode: 200,
          body: JSON.stringify({ message: '2FA verified successfully' })
        };
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid 2FA code' })
        };
      }
    }

    // If it's an SNS message handling for sending 2FA code
    const message = JSON.parse(event.Records[0].Sns.Message);
    const userEmail = message.userEmail;

    // Generate 2FA code
    const secret = speakeasy.generateSecret({ length: 6 });
    const twoFactorCode = secret.base32;

    // Update DynamoDB with the generated 2FA code
    const updateParams = {
      TableName: process.env.DYNAMODB_TABLE,
      Key: {
        'useremail': { S: userEmail }, 
      },
      UpdateExpression: 'SET twoFactorCode = :codeValue',
      ExpressionAttributeValues: {
        ':codeValue': { S: twoFactorCode },
      },
    };

    // Asynchronously update DynamoDB item (non-blocking)
    dynamoDb.updateItem(updateParams, function (err, data) {
      if (err) {
        console.log("Error updating item:", err);
      } else {
        console.log("Successfully updated item in UsersTable:", data);
      }
    });

    // Simulate sending the 2FA code to the user via SES (email)
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

    // Asynchronously send email (non-blocking)
    await ses.sendEmail(emailParams).promise();

    console.log('Two-factor authentication code sent to:', userEmail);

    // Return success response for SNS message handling
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Message processed successfully' })
    };
  } catch (error) {
    console.error('Error processing message:', error);

    // Handle specific errors (e.g., SES message rejection)
    if (error.code === 'MessageRejected') {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'Message rejected by SES' })
      };
    } else {
      return {
        statusCode: 500,
        body: JSON.stringify({ message: 'Failed to process message' })
      };
    }
  }
};



module.exports = {
  UserLoginHandler,
  processUserValidation,
  GetLoginFormHandler
};


