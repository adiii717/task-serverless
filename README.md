## Live Deployment

To Deploy to live provider that is AWS, make sure to set profile and then run the following command


```sh
# on fresh install
npm install && export AWS_PROFILE=task && npm run deploy
# on regular deployment
export AWS_PROFILE=profilename && npm run deploy
```


## Local Testing

To Invoke the function locally, run the following command

```sh
npm run local-invoke
```

It will also pass the test event file that lamda expects for user validation



## Why Serverless

Easily build auto-scaling, low-overhead applications on AWS Lambda, API Gateway, DynamoDB, and other managed services with the Serverless Framework.